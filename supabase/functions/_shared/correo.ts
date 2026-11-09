import nodemailer from "npm:nodemailer@6.9.16"
import { admin, consultar } from "./supabase.ts"

export interface ConfigSmtp {
  host: string
  puerto: number
  seguridad: "starttls" | "ssl" | "none"
  usuario: string
  password: string
  remitente: string
  nombre_remitente: string
  dry_run: boolean
}

export interface ResultadoEnvio {
  ok: boolean
  detalle: string
}

export const obtenerConfigSmtp = (): Promise<ConfigSmtp> =>
  consultar<ConfigSmtp>(admin.from("smtp_config").select("*").eq("id", true).single())

export const smtpConfigurado = (c: ConfigSmtp): boolean => Boolean(c.host && c.usuario && c.password && c.remitente)

export interface Transporte {
  verify(): Promise<unknown>
  sendMail(mensaje: Record<string, unknown>): Promise<unknown>
}

type FabricaTransporte = (config: ConfigSmtp) => Transporte

const transporteNodemailer: FabricaTransporte = (c) =>
  nodemailer.createTransport({
    host: c.host,
    port: c.puerto,
    secure: c.seguridad === "ssl",
    requireTLS: c.seguridad === "starttls",
    ignoreTLS: c.seguridad === "none",
    auth: { user: c.usuario, pass: c.password },
    connectionTimeout: 30_000,
    greetingTimeout: 30_000,
    socketTimeout: 30_000,
  })

let crearTransporte: FabricaTransporte = transporteNodemailer

export function usarTransporte(fabrica: FabricaTransporte | undefined): void {
  crearTransporte = fabrica ?? transporteNodemailer
}

const detalleError = (error: unknown): string =>
  `${error instanceof Error ? error.name : "Error"}: ${error instanceof Error ? error.message : String(error)}`

export async function probarConexion(): Promise<ResultadoEnvio> {
  const config = await obtenerConfigSmtp()
  if (!smtpConfigurado(config)) {
    return { ok: false, detalle: "Faltan datos: correo de la cuenta, contraseña y remitente." }
  }
  try {
    await crearTransporte(config).verify()
    return { ok: true, detalle: `Conexión correcta con ${config.host} como ${config.usuario}.` }
  } catch (error) {
    return { ok: false, detalle: detalleError(error) }
  }
}

export async function enviarCorreo(
  destinatarios: string[],
  asunto: string,
  html: string,
  forzar = false,
): Promise<ResultadoEnvio> {
  const config = await obtenerConfigSmtp()
  const destinos = [...new Set(destinatarios.map((d) => d.trim()).filter(Boolean))]
  if (destinos.length === 0) return { ok: false, detalle: "Sin destinatarios válidos" }
  if (config.dry_run && !forzar) return { ok: true, detalle: `Simulado (modo simulación): ${destinos.join(", ")}` }
  if (!smtpConfigurado(config)) {
    return { ok: false, detalle: "SMTP sin configurar: revisa usuario, contraseña y remitente en Alertas & Notificaciones" }
  }
  try {
    await crearTransporte(config).sendMail({
      from: { name: config.nombre_remitente, address: config.remitente },
      to: destinos,
      subject: asunto,
      text: "Este mensaje requiere un cliente de correo compatible con HTML.",
      html,
    })
    return { ok: true, detalle: `Enviado a ${destinos.join(", ")}` }
  } catch (error) {
    return { ok: false, detalle: detalleError(error) }
  }
}

export function explicarError(detalle: string): string {
  const d = detalle.toLowerCase()
  if (d.includes("5.7.139") || d.includes("smtpclientauthentication is disabled") || d.includes("smtp auth")) {
    return (
      "Tu buzón de Office 365 tiene desactivado SMTP AUTH. Pide al administrador de Microsoft 365 que lo active para " +
      "tu cuenta (Centro de administración → Usuarios → tu usuario → Correo → Administrar aplicaciones de correo → " +
      "SMTP autenticado)."
    )
  }
  if (d.includes("535") || d.includes("authentication") || d.includes("username and password") || d.includes("credentials")) {
    return (
      "Usuario o contraseña rechazados. Si tu cuenta tiene verificación en dos pasos (MFA), necesitas una " +
      "contraseña de aplicación en lugar de tu contraseña normal. En Gmail se crea en myaccount.google.com/apppasswords."
    )
  }
  const fallosDeRed = ["timed out", "timeout", "etimedout", "econnreset", "getaddrinfo", "enotfound", "econnrefused", "connection refused", "unreachable"]
  if (fallosDeRed.some((t) => d.includes(t))) {
    return "No hay conexión con el servidor. Revisa el servidor y el puerto, y que ningún firewall bloquee el puerto 587."
  }
  if (d.includes("5.7.60") || d.includes("send as") || d.includes("sendasdenied")) {
    return "El remitente no coincide con la cuenta. Usa como remitente el mismo correo con el que inicias sesión."
  }
  return "Revisa los datos del servidor y vuelve a probar."
}
