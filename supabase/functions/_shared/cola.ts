import { enviarCorreo } from "./correo.ts"
import { admin, consultar } from "./supabase.ts"
import { inicioDelDia, sumarHoras } from "./tiempo.ts"
import type { AlertaProgramada, Destinatario } from "./tipos.ts"

const MAX_INTENTOS = 3
const REINTENTO_HORAS = 10 / 60
const CODIGO_DUPLICADO = "23505"

interface NuevaAlerta {
  regla: string
  entidad: string
  entidadId: number | null
  asunto: string
  cuerpo: string
  destinatarios: Destinatario[]
  enviarEn?: Date
  clave?: string
}

export async function existeClave(clave: string): Promise<boolean> {
  const fila = await consultar<{ id: number } | null>(
    admin.from("alerta_programada").select("id").eq("clave_unica", clave).maybeSingle(),
  )
  return fila !== null
}

async function yaOmitidaHoy({ regla, asunto }: NuevaAlerta): Promise<boolean> {
  const previas = await consultar<{ id: number }[]>(
    admin
      .from("notificacion_log")
      .select("id")
      .eq("regla_codigo", regla)
      .eq("asunto", asunto)
      .eq("estado", "Omitida")
      .gte("fecha", inicioDelDia().toISOString())
      .limit(1),
  )
  return previas.length > 0
}

async function registrarOmitida(alerta: NuevaAlerta): Promise<void> {
  if (alerta.clave && (await yaOmitidaHoy(alerta))) return
  await consultar(
    admin.from("notificacion_log").insert({
      regla_codigo: alerta.regla,
      asunto: alerta.asunto,
      destinatarios: "",
      estado: "Omitida",
      detalle: "Sin destinatarios con correo válido",
    }),
  )
}

export async function encolar(alerta: NuevaAlerta): Promise<number | null> {
  if (alerta.destinatarios.length === 0) {
    await registrarOmitida(alerta)
    return null
  }
  if (alerta.clave && (await existeClave(alerta.clave))) return null

  const { data, error } = await admin
    .from("alerta_programada")
    .insert({
      regla_codigo: alerta.regla,
      entidad: alerta.entidad,
      entidad_id: alerta.entidadId,
      clave_unica: alerta.clave ?? null,
      asunto: alerta.asunto,
      cuerpo_html: alerta.cuerpo,
      destinatarios: alerta.destinatarios.map((d) => d.correo),
      enviar_en: (alerta.enviarEn ?? new Date()).toISOString(),
    })
    .select("id")
    .single()
  if (error?.code === CODIGO_DUPLICADO) return null
  if (error) throw new Error(error.message)
  return data.id as number
}

async function reservar(alerta: AlertaProgramada): Promise<boolean> {
  const filas = await consultar<{ id: number }[]>(
    admin
      .from("alerta_programada")
      .update({ enviar_en: sumarHoras(new Date(), REINTENTO_HORAS).toISOString() })
      .eq("id", alerta.id)
      .eq("estado", "Pendiente")
      .eq("enviar_en", alerta.enviar_en)
      .select("id"),
  )
  return filas.length > 0
}

async function registrarResultado(alerta: AlertaProgramada, ok: boolean, detalle: string): Promise<void> {
  const intentos = alerta.intentos + 1
  const cambios = ok
    ? { estado: "Enviada", intentos, enviado_en: new Date().toISOString(), error: null }
    : {
        estado: intentos >= MAX_INTENTOS ? "Fallida" : "Pendiente",
        intentos,
        error: detalle,
        enviar_en: sumarHoras(new Date(), REINTENTO_HORAS).toISOString(),
      }
  await consultar(admin.from("alerta_programada").update(cambios).eq("id", alerta.id))
  await consultar(
    admin.from("notificacion_log").insert({
      alerta_id: alerta.id,
      regla_codigo: alerta.regla_codigo,
      asunto: alerta.asunto,
      destinatarios: alerta.destinatarios.join(", "),
      estado: ok ? "Enviada" : "Fallida",
      detalle,
    }),
  )
}

export async function despachar(): Promise<{ enviadas: number; fallidas: number }> {
  const pendientes = await consultar<AlertaProgramada[]>(
    admin
      .from("alerta_programada")
      .select("id, regla_codigo, asunto, cuerpo_html, destinatarios, enviar_en, intentos")
      .eq("estado", "Pendiente")
      .lte("enviar_en", new Date().toISOString())
      .order("enviar_en"),
  )
  let enviadas = 0
  let fallidas = 0
  for (const alerta of pendientes) {
    if (!(await reservar(alerta))) continue
    const { ok, detalle } = await enviarCorreo(alerta.destinatarios, alerta.asunto, alerta.cuerpo_html)
    await registrarResultado(alerta, ok, detalle)
    if (ok) enviadas += 1
    else fallidas += 1
  }
  return { enviadas, fallidas }
}
