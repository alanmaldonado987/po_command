import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1"
import {
  enviarCorreo,
  explicarError,
  obtenerConfigSmtp,
  probarConexion,
  smtpConfigurado,
  usarTransporte,
} from "../_shared/correo.ts"
import { crearEntorno, smtp } from "./entorno.ts"

Deno.test("smtpConfigurado exige servidor, usuario, contraseña y remitente", async () => {
  crearEntorno()
  assertEquals(smtpConfigurado(await obtenerConfigSmtp()), true)
  for (const campo of ["host", "usuario", "password", "remitente"]) {
    crearEntorno({ smtp_config: [smtp({ [campo]: "" })] })
    assertEquals(smtpConfigurado(await obtenerConfigSmtp()), false, `sin ${campo}`)
  }
})

Deno.test("en modo simulación no se envía nada real", async () => {
  const { transporte } = crearEntorno()
  const r = await enviarCorreo(["a@ises.com.co", "b@ises.com.co"], "Asunto", "<p>x</p>")
  assertEquals(r.ok, true)
  assertStringIncludes(r.detalle, "Simulado")
  assertStringIncludes(r.detalle, "a@ises.com.co, b@ises.com.co")
  assertEquals(transporte.enviados.length, 0)
})

Deno.test("forzar envía de verdad aunque esté en simulación", async () => {
  const { transporte } = crearEntorno()
  const r = await enviarCorreo(["a@ises.com.co"], "Prueba", "<p>x</p>", true)
  assertEquals(r.ok, true)
  assertEquals(r.detalle, "Enviado a a@ises.com.co")
  assertEquals(transporte.enviados.length, 1)
})

Deno.test("enviar sin destinatarios válidos falla antes de cualquier otra cosa", async () => {
  const { transporte } = crearEntorno()
  assertEquals(await enviarCorreo([], "A", "h"), { ok: false, detalle: "Sin destinatarios válidos" })
  assertEquals(await enviarCorreo(["  ", ""], "A", "h"), { ok: false, detalle: "Sin destinatarios válidos" })
  assertEquals(transporte.enviados.length, 0)
})

Deno.test("los destinatarios se recortan y se deduplican", async () => {
  const { transporte } = crearEntorno({ smtp_config: [smtp({ dry_run: false })] })
  await enviarCorreo([" a@ises.com.co ", "a@ises.com.co", "b@ises.com.co"], "A", "h")
  assertEquals(transporte.enviados[0].to, ["a@ises.com.co", "b@ises.com.co"])
})

Deno.test("enviar en modo real sin SMTP configurado devuelve un mensaje accionable", async () => {
  const { transporte } = crearEntorno({ smtp_config: [smtp({ dry_run: false, usuario: "" })] })
  const r = await enviarCorreo(["a@ises.com.co"], "A", "h")
  assertEquals(r.ok, false)
  assertStringIncludes(r.detalle, "SMTP sin configurar")
  assertEquals(transporte.enviados.length, 0)
})

Deno.test("un error del servidor SMTP se devuelve como detalle sin lanzar excepción", async () => {
  const { transporte } = crearEntorno({ smtp_config: [smtp({ dry_run: false })] })
  transporte.error = new Error("535 5.7.3 Authentication unsuccessful")
  const r = await enviarCorreo(["a@ises.com.co"], "A", "h")
  assertEquals(r, { ok: false, detalle: "Error: 535 5.7.3 Authentication unsuccessful" })
})

Deno.test("un valor lanzado que no es Error también se describe", async () => {
  crearEntorno({ smtp_config: [smtp({ dry_run: false })] })
  usarTransporte(() => ({
    verify: () => Promise.reject("texto plano"),
    sendMail: () => Promise.reject("texto plano"),
  }))
  assertEquals((await enviarCorreo(["a@ises.com.co"], "A", "h")).detalle, "Error: texto plano")
})

Deno.test("probarConexion verifica el servidor sin enviar correo", async () => {
  const { transporte } = crearEntorno()
  const r = await probarConexion()
  assertEquals(r.ok, true)
  assertEquals(r.detalle, "Conexión correcta con smtp.test como cuenta@ises.com.co.")
  assertEquals(transporte.verificaciones, 1)
  assertEquals(transporte.enviados.length, 0)
})

Deno.test("probarConexion sin datos completos no intenta conectar", async () => {
  const { transporte } = crearEntorno({ smtp_config: [smtp({ password: "" })] })
  const r = await probarConexion()
  assertEquals(r.ok, false)
  assertStringIncludes(r.detalle, "Faltan datos")
  assertEquals(transporte.verificaciones, 0)
})

Deno.test("probarConexion devuelve el error del servidor", async () => {
  const { transporte } = crearEntorno()
  transporte.error = new Error("getaddrinfo ENOTFOUND smtp.test")
  const r = await probarConexion()
  assertEquals(r.ok, false)
  assertStringIncludes(r.detalle, "ENOTFOUND")
})

const casosDeError: [string, string, string][] = [
  ["5.7.139", "535 5.7.139 Authentication unsuccessful, SmtpClientAuthentication is disabled for the Tenant", "SMTP AUTH"],
  ["SmtpClientAuthentication", "SmtpClientAuthentication is disabled", "SMTP AUTH"],
  ["535", "Invalid login: 535 5.7.3 Authentication unsuccessful", "contraseña de aplicación"],
  ["credenciales", "Bad Credentials", "contraseña de aplicación"],
  ["timeout de nodemailer", "Connection timeout", "No hay conexión"],
  ["ETIMEDOUT", "connect ETIMEDOUT 52.96.1.1:587", "No hay conexión"],
  ["ECONNRESET", "read ECONNRESET", "No hay conexión"],
  ["DNS", "getaddrinfo ENOTFOUND smtp.office365.com", "No hay conexión"],
  ["rechazo de conexión", "connect ECONNREFUSED 127.0.0.1:587", "No hay conexión"],
  ["5.7.60", "550 5.7.60 SMTP; Client does not have permissions to send as this sender", "remitente no coincide"],
  ["SendAsDenied", "SendAsDenied", "remitente no coincide"],
  ["desconocido", "algo inesperado", "Revisa los datos del servidor"],
]

for (const [nombre, detalle, esperado] of casosDeError) {
  Deno.test(`explicarError traduce: ${nombre}`, () => {
    assertStringIncludes(explicarError(detalle), esperado)
  })
}

Deno.test("explicarError distingue SMTP AUTH deshabilitado de credenciales incorrectas", () => {
  assert(!explicarError("535 5.7.139 ... SmtpClientAuthentication is disabled").includes("contraseña de aplicación"))
})
