import { listarItemsAbiertos } from "./items.ts"
import { plantilla } from "./plantilla.ts"
import { admin, consultar } from "./supabase.ts"
import { hoy, formatoLocal, sumarDias } from "./tiempo.ts"
import type { BloqueanteAbierto, Ceremonia, Fila, Item } from "./tipos.ts"

const ESTADO_PRUEBAS = "Terminado, en etapa de pruebas"

interface AvanceCliente {
  cliente: string
  total: number
  terminados: number
  pruebas: number
  enCurso: number
  noIniciados: number
}

export function avancePorCliente(items: Item[]): AvanceCliente[] {
  const grupos = new Map<string, AvanceCliente>()
  for (const { cliente, estado } of items) {
    const nombre = cliente ?? "Sin cliente"
    const avance = grupos.get(nombre) ?? { cliente: nombre, total: 0, terminados: 0, pruebas: 0, enCurso: 0, noIniciados: 0 }
    avance.total += 1
    if (estado === "Terminado") avance.terminados += 1
    else if (estado === ESTADO_PRUEBAS) avance.pruebas += 1
    else if (estado === "En curso") avance.enCurso += 1
    else if (estado === "No iniciado") avance.noIniciados += 1
    grupos.set(nombre, avance)
  }
  return [...grupos.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, "es"))
}

export async function resumenSemanalHtml(ahora = new Date()): Promise<string> {
  const fechaHoy = hoy(ahora)
  const hace7 = sumarDias(fechaHoy, -7)
  const [todos, abiertos, bloqueantes, reprogramaciones, ceremonias] = await Promise.all([
    consultar<Item[]>(admin.from("v_item").select("*")),
    listarItemsAbiertos(),
    consultar<BloqueanteAbierto[]>(admin.from("v_bloqueante_abierto").select("*").order("abierto_en")),
    admin.from("nota").select("*", { count: "exact", head: true }).eq("tipo", "Reprogramación").gte("fecha", hace7),
    consultar<Ceremonia[]>(
      admin.from("v_ceremonia").select("*").gte("fecha_hora", ahora.toISOString()).order("fecha_hora").limit(3),
    ),
  ])
  if (reprogramaciones.error) throw new Error(reprogramaciones.error.message)
  const terminados = todos.filter((item) => item.terminado_en && item.terminado_en >= hace7)
  const vencidos = abiertos.filter((item) => item.fecha_compromiso && item.fecha_compromiso < fechaHoy)

  const filas: Fila[] = avancePorCliente(todos).map((a) => [
    `Avance ${a.cliente}`,
    `${a.terminados} terminados · ${a.pruebas} en pruebas · ${a.enCurso} en curso · ${a.noIniciados} sin iniciar (de ${a.total})`,
  ])
  filas.push(
    ["Terminados en 7 días", String(terminados.length)],
    ["Vencidos sin terminar", String(vencidos.length)],
    ["Reprogramaciones en 7 días", String(reprogramaciones.count ?? 0)],
    ["Bloqueantes abiertos", String(bloqueantes.length)],
  )
  bloqueantes.slice(0, 3).forEach((b) => filas.push([`Bloqueo ${b.codigo} · ${b.cliente ?? "-"}`, b.motivo]))
  ceremonias.forEach((c) => filas.push([`Próximo: ${c.tipo}`, `${c.titulo} · ${formatoLocal(c.fecha_hora)}`]))

  return plantilla({
    titulo: "Resumen semanal del plan de trabajo",
    saludo: "Hola,",
    intro: "Este es el estado de la semana:",
    filas,
  })
}
