import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1"
import { despachar, encolar, existeClave } from "../_shared/cola.ts"
import { crearEntorno, smtp } from "./entorno.ts"

const destinatarios = [{ nombre: "Luis", correo: "luis@ises.com.co", rol: "Responsable" }]
const alertaBase = { regla: "BLOQUEO_NUEVO", entidad: "item", entidadId: 7, asunto: "Asunto", cuerpo: "<p>Hola</p>", destinatarios }

const minutosDesde = (iso: unknown): number => (Date.parse(String(iso)) - Date.now()) / 60_000

Deno.test("encolar guarda la alerta pendiente con los correos de los destinatarios", async () => {
  const { base } = crearEntorno()
  const id = await encolar(alertaBase)
  assertEquals(id, 1)
  const [fila] = base.filas("alerta_programada")
  assertEquals(fila.regla_codigo, "BLOQUEO_NUEVO")
  assertEquals(fila.entidad, "item")
  assertEquals(fila.entidad_id, 7)
  assertEquals(fila.estado, "Pendiente")
  assertEquals(fila.destinatarios, ["luis@ises.com.co"])
  assertEquals(fila.clave_unica, null)
})

Deno.test("encolar con clave repetida no crea una segunda alerta", async () => {
  const { base } = crearEntorno()
  assertEquals(await encolar({ ...alertaBase, clave: "VEN:1:2026-11-06" }), 1)
  assertEquals(await existeClave("VEN:1:2026-11-06"), true)
  assertEquals(await encolar({ ...alertaBase, clave: "VEN:1:2026-11-06" }), null)
  assertEquals(await encolar({ ...alertaBase, clave: "VEN:1:2026-11-07" }), 2)
  assertEquals(base.filas("alerta_programada").length, 2)
})

Deno.test("encolar trata la violación de unicidad de la base como duplicado, no como error", async () => {
  const { base } = crearEntorno()
  base.fallar("alerta_programada", "insert", "duplicate key", "23505")
  assertEquals(await encolar({ ...alertaBase, clave: "X" }), null)
})

Deno.test("encolar propaga cualquier otro error de la base", async () => {
  const { base } = crearEntorno()
  base.fallar("alerta_programada", "insert", "disco lleno")
  await assertRejects(() => encolar(alertaBase), Error, "disco lleno")
})

Deno.test("encolar sin destinatarios registra 'Omitida' y no crea alerta", async () => {
  const { base } = crearEntorno()
  assertEquals(await encolar({ ...alertaBase, destinatarios: [] }), null)
  assertEquals(base.filas("alerta_programada").length, 0)
  const [log] = base.filas("notificacion_log")
  assertEquals(log.estado, "Omitida")
  assertEquals(log.regla_codigo, "BLOQUEO_NUEVO")
  assertEquals(log.detalle, "Sin destinatarios con correo válido")
})

Deno.test("una alerta con clave sin destinatarios solo se registra como omitida una vez por día", async () => {
  const { base } = crearEntorno()
  const sinNadie = { ...alertaBase, destinatarios: [], clave: "VEN:0:2026-11-06" }
  await encolar(sinNadie)
  await encolar(sinNadie)
  await encolar(sinNadie)
  assertEquals(base.filas("notificacion_log").length, 1)
})

Deno.test("una alerta sin clave y sin destinatarios se registra cada vez (acción del usuario)", async () => {
  const { base } = crearEntorno()
  await encolar({ ...alertaBase, destinatarios: [] })
  await encolar({ ...alertaBase, destinatarios: [] })
  assertEquals(base.filas("notificacion_log").length, 2)
})

Deno.test("la omisión de ayer no impide registrar la de hoy", async () => {
  const { base } = crearEntorno({
    notificacion_log: [
      { id: 1, regla_codigo: "BLOQUEO_NUEVO", asunto: "Asunto", estado: "Omitida", fecha: "2020-01-01T00:00:00.000Z" },
    ],
  })
  await encolar({ ...alertaBase, destinatarios: [], clave: "K" })
  assertEquals(base.filas("notificacion_log").length, 2)
})

Deno.test("despachar en modo simulación marca enviada, no usa SMTP y deja log", async () => {
  const { base, transporte } = crearEntorno()
  await encolar(alertaBase)
  assertEquals(await despachar(), { enviadas: 1, fallidas: 0 })
  assertEquals(transporte.enviados.length, 0)
  const [alerta] = base.filas("alerta_programada")
  assertEquals(alerta.estado, "Enviada")
  assertEquals(alerta.intentos, 1)
  assert(alerta.enviado_en)
  const [log] = base.filas("notificacion_log")
  assertEquals(log.estado, "Enviada")
  assertEquals(log.alerta_id, alerta.id)
  assert(String(log.detalle).startsWith("Simulado"))
  assertEquals(log.destinatarios, "luis@ises.com.co")
})

Deno.test("despachar con envío real entrega el correo por SMTP con remitente y HTML", async () => {
  const { transporte } = crearEntorno({ smtp_config: [smtp({ dry_run: false })] })
  await encolar({ ...alertaBase, destinatarios: [...destinatarios, { nombre: "Ana", correo: "ana@ises.com.co", rol: "PO" }] })
  assertEquals(await despachar(), { enviadas: 1, fallidas: 0 })
  assertEquals(transporte.enviados.length, 1)
  const [correo] = transporte.enviados
  assertEquals(correo.to, ["luis@ises.com.co", "ana@ises.com.co"])
  assertEquals(correo.subject, "Asunto")
  assertEquals(correo.html, "<p>Hola</p>")
  assertEquals(correo.from, { name: "PO Command Center", address: "cuenta@ises.com.co" })
})

Deno.test("despachar ignora alertas programadas para el futuro y las que no están pendientes", async () => {
  const { base } = crearEntorno()
  await encolar({ ...alertaBase, enviarEn: new Date(Date.now() + 3_600_000), clave: "futura" })
  await encolar({ ...alertaBase, clave: "cancelada" })
  base.filas("alerta_programada")[1].estado = "Cancelada"
  assertEquals(await despachar(), { enviadas: 0, fallidas: 0 })
  assertEquals(base.filas("alerta_programada")[0].estado, "Pendiente")
  assertEquals(base.filas("notificacion_log").length, 0)
})

Deno.test("un fallo de envío deja la alerta pendiente, cuenta el intento y reprograma 10 minutos", async () => {
  const { base, transporte } = crearEntorno({ smtp_config: [smtp({ dry_run: false })] })
  transporte.error = new Error("connect ETIMEDOUT")
  await encolar(alertaBase)
  assertEquals(await despachar(), { enviadas: 0, fallidas: 1 })
  const [alerta] = base.filas("alerta_programada")
  assertEquals(alerta.estado, "Pendiente")
  assertEquals(alerta.intentos, 1)
  assertEquals(alerta.error, "Error: connect ETIMEDOUT")
  const espera = minutosDesde(alerta.enviar_en)
  assert(espera > 9.5 && espera < 10.5, `se esperaba ~10 min y fueron ${espera}`)
  const [log] = base.filas("notificacion_log")
  assertEquals(log.estado, "Fallida")
})

Deno.test("tras el reintento programado todavía no vencido la alerta no se vuelve a intentar", async () => {
  const { base, transporte } = crearEntorno({ smtp_config: [smtp({ dry_run: false })] })
  transporte.error = new Error("fallo")
  await encolar(alertaBase)
  await despachar()
  assertEquals(await despachar(), { enviadas: 0, fallidas: 0 })
  assertEquals(base.filas("alerta_programada")[0].intentos, 1)
})

Deno.test("después de 3 intentos fallidos la alerta pasa a Fallida y deja de reintentarse", async () => {
  const { base, transporte } = crearEntorno({ smtp_config: [smtp({ dry_run: false })] })
  transporte.error = new Error("fallo permanente")
  await encolar(alertaBase)
  for (let intento = 1; intento <= 3; intento++) {
    base.filas("alerta_programada")[0].enviar_en = new Date(Date.now() - 1000).toISOString()
    assertEquals(await despachar(), { enviadas: 0, fallidas: 1 })
  }
  const [alerta] = base.filas("alerta_programada")
  assertEquals(alerta.estado, "Fallida")
  assertEquals(alerta.intentos, 3)
  alerta.enviar_en = new Date(Date.now() - 1000).toISOString()
  assertEquals(await despachar(), { enviadas: 0, fallidas: 0 })
  assertEquals(base.filas("notificacion_log").length, 3)
})

Deno.test("un reintento exitoso después de un fallo termina en Enviada", async () => {
  const { base, transporte } = crearEntorno({ smtp_config: [smtp({ dry_run: false })] })
  transporte.error = new Error("fallo temporal")
  await encolar(alertaBase)
  await despachar()
  transporte.error = null
  base.filas("alerta_programada")[0].enviar_en = new Date(Date.now() - 1000).toISOString()
  assertEquals(await despachar(), { enviadas: 1, fallidas: 0 })
  const [alerta] = base.filas("alerta_programada")
  assertEquals(alerta.estado, "Enviada")
  assertEquals(alerta.intentos, 2)
  assertEquals(alerta.error, null)
})

Deno.test("dos despachos simultáneos no envían el mismo correo dos veces", async () => {
  const { base, transporte } = crearEntorno({ smtp_config: [smtp({ dry_run: false })] })
  await encolar(alertaBase)
  const [a, b] = await Promise.all([despachar(), despachar()])
  assertEquals(a.enviadas + b.enviadas, 1)
  assertEquals(transporte.enviados.length, 1)
  assertEquals(base.filas("notificacion_log").length, 1)
})

Deno.test("SMTP sin configurar en modo real falla con un mensaje claro", async () => {
  const { base } = crearEntorno({ smtp_config: [smtp({ dry_run: false, password: "" })] })
  await encolar(alertaBase)
  assertEquals(await despachar(), { enviadas: 0, fallidas: 1 })
  assert(String(base.filas("alerta_programada")[0].error).startsWith("SMTP sin configurar"))
})
