import { encolar } from "./cola.ts"
import { reglaActiva } from "./configuracion.ts"
import { resolver } from "./destinatarios.ts"
import { obtenerItem, ubicacion } from "./items.ts"
import { plantilla } from "./plantilla.ts"
import { formatoFecha } from "./tiempo.ts"
import type { CambioFecha, Fila, Item, ResultadoGuardado } from "./tipos.ts"

const ETIQUETAS_FECHA: Record<string, string> = {
  plan_ini: "inicio planificado",
  plan_fin: "fin planificado",
  plan_pruebas_ini: "inicio de pruebas planificado",
  plan_pruebas_fin: "fin de pruebas planificado",
}

const capitalizar = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1)

export interface OpcionesAviso {
  origen?: string
  clave?: string
}

const filaOrigen = ({ origen }: OpcionesAviso): Fila[] => (origen ? [["Cambio hecho en", origen]] : [])
const claveDe = (regla: string, { clave }: OpcionesAviso): string | undefined => (clave ? `${clave}:${regla}` : undefined)

async function avisarBloqueo(item: Item, opciones: OpcionesAviso): Promise<string | null> {
  const regla = await reglaActiva("BLOQUEO_NUEVO")
  if (!regla) return null
  const destinatarios = await resolver(regla.destinatarios, regla.categoria, { item })
  const cuerpo = await plantilla({
    titulo: `${item.codigo} está bloqueado`,
    saludo: "Hola,",
    intro: `El ítem ${item.codigo} (${item.titulo}) fue marcado como bloqueado.`,
    filas: [
      ...ubicacion(item),
      ["Motivo", item.motivo_bloqueo || "-"],
      ["Responsable", item.responsable ?? "Sin asignar"],
      ["Fecha fin planificada", formatoFecha(item.fecha_compromiso)],
      ...filaOrigen(opciones),
    ],
    cierre: "Si sigue abierto se escalará automáticamente a los stakeholders del cliente.",
    color: "#B91C1C",
  })
  const id = await encolar({
    regla: "BLOQUEO_NUEVO",
    entidad: "item",
    entidadId: item.id,
    asunto: `[Bloqueante] ${item.codigo} ${item.cliente ?? ""} · ${item.titulo}`,
    cuerpo,
    destinatarios,
    clave: claveDe("BLOQUEO_NUEVO", opciones),
  })
  return id
    ? `Alerta de bloqueante para ${destinatarios.length} destinatario(s).`
    : "Bloqueo registrado, pero no hay destinatarios con correo válido."
}

async function avisarDesbloqueo(item: Item, motivoAnterior: string, opciones: OpcionesAviso): Promise<void> {
  const regla = await reglaActiva("BLOQUEO_RESUELTO")
  if (!regla) return
  const cuerpo = await plantilla({
    titulo: `${item.codigo} desbloqueado`,
    saludo: "Hola,",
    intro: `El bloqueo de ${item.codigo} quedó resuelto y el ítem continúa en estado ${item.estado}.`,
    filas: [...ubicacion(item), ["Motivo que tenía", motivoAnterior || "-"], ...filaOrigen(opciones)],
    color: "#047857",
  })
  await encolar({
    regla: "BLOQUEO_RESUELTO",
    entidad: "item",
    entidadId: item.id,
    asunto: `[Resuelto] ${item.codigo} ${item.titulo}`,
    cuerpo,
    destinatarios: await resolver(regla.destinatarios, regla.categoria, { item }),
    clave: claveDe("BLOQUEO_RESUELTO", opciones),
  })
}

async function avisarReprogramacion(item: Item, cambios: CambioFecha[], opciones: OpcionesAviso): Promise<string | null> {
  const regla = await reglaActiva("REPROGRAMACION")
  if (!regla) return null
  const destinatarios = await resolver(regla.destinatarios, regla.categoria, { item })
  const filasCambios: Fila[] = cambios.map(({ campo, antes, despues }) => [
    capitalizar(ETIQUETAS_FECHA[campo] ?? campo),
    `${formatoFecha(antes)} → ${formatoFecha(despues)}`,
  ])
  const cuerpo = await plantilla({
    titulo: `${item.codigo} cambió de fechas`,
    saludo: "Hola,",
    intro: `Se reprogramó el ítem ${item.codigo} (${item.titulo}).`,
    filas: [...ubicacion(item), ...filasCambios, ...filaOrigen(opciones)],
    color: "#B45309",
  })
  const id = await encolar({
    regla: "REPROGRAMACION",
    entidad: "item",
    entidadId: item.id,
    asunto: `[Reprogramación] ${item.codigo} ${item.titulo}`,
    cuerpo,
    destinatarios,
    clave: claveDe("REPROGRAMACION", opciones),
  })
  return id ? `Reprogramación avisada a ${destinatarios.length} destinatario(s).` : null
}

export async function alGuardarItem({ id, antes, cambios }: ResultadoGuardado, opciones: OpcionesAviso = {}): Promise<string> {
  const item = await obtenerItem(id)
  const mensajes: (string | null)[] = []

  if (item.bloqueado && !antes?.bloqueado) {
    mensajes.push(await avisarBloqueo(item, opciones))
  } else if (antes?.bloqueado && !item.bloqueado) {
    await avisarDesbloqueo(item, antes.motivo_bloqueo, opciones)
    mensajes.push("Bloqueo resuelto: se avisa al equipo y se cancelan los escalamientos.")
  }
  if (cambios.length > 0) mensajes.push(await avisarReprogramacion(item, cambios, opciones))

  return mensajes.filter(Boolean).join(" ")
}
