import { despachar, encolar } from "../_shared/cola.ts"
import { obtenerRegla } from "../_shared/configuracion.ts"
import { resolver } from "../_shared/destinatarios.ts"
import { alGuardarItem } from "../_shared/eventos.ts"
import { listarItemsPorId, obtenerItem } from "../_shared/items.ts"
import { plantilla } from "../_shared/plantilla.ts"
import { avisarVencimientos, escalar, revisar } from "../_shared/reglas.ts"
import { ErrorSolicitud, exigir, manejar } from "../_shared/respuesta.ts"
import { resumenSemanalHtml } from "../_shared/resumen.ts"
import { admin, consultar } from "../_shared/supabase.ts"
import { formatoLocal, hoy } from "../_shared/tiempo.ts"
import type { BloqueanteAbierto, Ceremonia, ResultadoGuardado } from "../_shared/tipos.ts"

type Cuerpo = Record<string, unknown>

const tick = async () => {
  const creadas = await revisar()
  return { creadas, ...(await despachar()) }
}

const alGuardar = async ({ resultado }: Cuerpo) => {
  exigir(typeof (resultado as ResultadoGuardado | undefined)?.id === "number", "Falta el resultado del guardado del ítem")
  const mensaje = await alGuardarItem(resultado as ResultadoGuardado)
  await despachar()
  return { mensaje }
}

async function escalarBloqueo({ bloqueante_id }: Cuerpo) {
  exigir(typeof bloqueante_id === "number", "Falta bloqueante_id")
  const bloqueante = await consultar<BloqueanteAbierto | null>(
    admin.from("v_bloqueante_abierto").select("*").eq("id", bloqueante_id).maybeSingle(),
  )
  const regla = await obtenerRegla("BLOQUEO_ESCALAR")
  if (!bloqueante || !regla) throw new ErrorSolicitud("Ese bloqueo ya no está abierto.")
  const ok = (await escalar(bloqueante, regla)) !== null
  await despachar()
  return { ok, mensaje: ok ? "Escalamiento enviado." : "No hay destinatarios con correo válido." }
}

async function enviarResumen() {
  const regla = await obtenerRegla("RESUMEN_SEMANAL")
  const destinatarios = regla ? await resolver(regla.destinatarios, regla.categoria) : []
  const [anio, mes, dia] = hoy().split("-")
  await encolar({
    regla: "RESUMEN_SEMANAL",
    entidad: "portafolio",
    entidadId: null,
    asunto: `[Resumen semanal] Plan de trabajo ${dia}/${mes}/${anio}`,
    cuerpo: await resumenSemanalHtml(),
    destinatarios,
  })
  await despachar()
  return { destinatarios: destinatarios.length, mensaje: `Resumen enviado a ${destinatarios.length} destinatario(s).` }
}

async function recordar({ item_ids }: Cuerpo) {
  exigir(Array.isArray(item_ids), "Falta item_ids")
  const items = await listarItemsPorId(item_ids as number[])
  const correos = await avisarVencimientos(items, await obtenerRegla("VENCIMIENTO"))
  await despachar()
  return {
    correos,
    mensaje: correos
      ? `${correos} correo(s) de recordatorio enviados (uno por responsable).`
      : "Hoy ya se había enviado el recordatorio a estos responsables.",
  }
}

async function invitarCeremonia({ ceremonia_id }: Cuerpo) {
  exigir(typeof ceremonia_id === "number", "Falta ceremonia_id")
  const ceremonia = await consultar<Ceremonia | null>(
    admin.from("v_ceremonia").select("*").eq("id", ceremonia_id).maybeSingle(),
  )
  if (!ceremonia) throw new ErrorSolicitud("La ceremonia no existe")
  const regla = await obtenerRegla("CEREMONIA")
  const destinatarios = await resolver(["audiencia", "po"], regla?.categoria ?? "Ceremonias", {
    audiencia: ceremonia.audiencia,
  })
  const cuerpo = await plantilla({
    titulo: `Invitación: ${ceremonia.titulo}`,
    saludo: "Hola,",
    intro: `Te invitamos a la ceremonia ${ceremonia.tipo}${ceremonia.cliente ? ` de ${ceremonia.cliente}.` : "."}`,
    filas: [
      ["Cuándo", formatoLocal(ceremonia.fecha_hora)],
      ["Duración", `${ceremonia.duracion_min} min`],
      ["Lugar", ceremonia.lugar],
      ["Notas", ceremonia.notas || "-"],
    ],
  })
  await encolar({
    regla: "CEREMONIA",
    entidad: "ceremonia",
    entidadId: ceremonia.id,
    asunto: `[Invitación] ${ceremonia.titulo} · ${formatoLocal(ceremonia.fecha_hora)}`,
    cuerpo,
    destinatarios,
    clave: `CER:${ceremonia.id}:invitacion:${ceremonia.fecha_hora}:${Date.now()}`,
  })
  await consultar(admin.from("ceremonia").update({ invitacion_enviada: true }).eq("id", ceremonia.id))
  await despachar()
  return { destinatarios: destinatarios.length }
}

async function consultarDestinatarios(cuerpo: Cuerpo) {
  let roles = (cuerpo.roles as string[] | undefined) ?? []
  let categoria = (cuerpo.categoria as string | undefined) ?? ""
  exigir(Array.isArray(roles), "roles debe ser una lista")
  if (cuerpo.regla_codigo) {
    const regla = await obtenerRegla(cuerpo.regla_codigo as string)
    if (!regla) throw new ErrorSolicitud(`La regla ${cuerpo.regla_codigo} no existe`)
    roles = regla.codigo === "CEREMONIA" ? ["audiencia", "po"] : regla.destinatarios
    categoria = regla.categoria
  }
  const item = cuerpo.item_id ? await obtenerItem(cuerpo.item_id as number) : null
  return resolver(roles, categoria, {
    item,
    clienteId: (cuerpo.cliente_id as number | undefined) ?? null,
    audiencia: (cuerpo.audiencia as string | undefined) ?? null,
  })
}

const ACCIONES: Record<string, (cuerpo: Cuerpo) => Promise<unknown>> = {
  tick,
  despachar,
  item_guardado: alGuardar,
  escalar: escalarBloqueo,
  resumen: enviarResumen,
  recordar,
  invitar_ceremonia: invitarCeremonia,
  destinatarios: consultarDestinatarios,
}

export const manejador = manejar((cuerpo) => {
  const accion = ACCIONES[cuerpo.accion as string]
  if (!accion) throw new ErrorSolicitud(`Acción desconocida: ${cuerpo.accion}`)
  return accion(cuerpo)
})
