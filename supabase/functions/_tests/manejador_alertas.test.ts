import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1"
import { manejador } from "../alertas/manejador.ts"
import type { Fila } from "./base_falsa.ts"
import { crearEntorno, item, persona, PO, regla, smtp } from "./entorno.ts"

async function llamar(cuerpo: unknown, metodo = "POST"): Promise<{ estado: number; datos: Record<string, unknown>; respuesta: Response }> {
  const respuesta = await manejador(
    new Request("http://localhost/functions/v1/alertas", {
      method: metodo,
      body: metodo === "POST" ? (typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo)) : undefined,
    }),
  )
  const texto = await respuesta.text()
  return { estado: respuesta.status, datos: texto.startsWith("{") || texto.startsWith("[") ? JSON.parse(texto) : {}, respuesta }
}

const luis = persona({ id: 1, nombre: "Luis", correo: "luis@ises.com.co" })
const bloqueanteAbierto = { id: 5, item_id: 105, codigo: "BL-005", cliente: "AIR-E", motivo: "Falta API", abierto_en: "2026-11-01T00:00:00Z", escalado_en: null }

Deno.test("OPTIONS responde con las cabeceras CORS y sin ejecutar nada", async () => {
  crearEntorno()
  const { estado, respuesta } = await llamar(null, "OPTIONS")
  assertEquals(estado, 200)
  assertEquals(respuesta.headers.get("Access-Control-Allow-Origin"), "*")
  assertStringIncludes(respuesta.headers.get("Access-Control-Allow-Headers") ?? "", "authorization")
})

Deno.test("una acción desconocida devuelve 400 con {error}", async () => {
  crearEntorno()
  const { estado, datos, respuesta } = await llamar({ accion: "borrar_todo" })
  assertEquals(estado, 400)
  assertEquals(datos, { error: "Acción desconocida: borrar_todo" })
  assertEquals(respuesta.headers.get("Content-Type"), "application/json")
  assertEquals(respuesta.headers.get("Access-Control-Allow-Origin"), "*")
})

Deno.test("sin acción o con un cuerpo que no es JSON también es 400", async () => {
  crearEntorno()
  assertEquals((await llamar({})).estado, 400)
  assertEquals((await llamar("esto no es json")).estado, 400)
})

Deno.test("un fallo de la base se informa como 500 con el mensaje", async () => {
  const { base } = crearEntorno()
  base.fallar("alerta_programada", "select", "base caída")
  const { estado, datos } = await llamar({ accion: "despachar" })
  assertEquals(estado, 500)
  assertEquals(datos, { error: "base caída" })
})

Deno.test("tick sin reglas activas devuelve ceros", async () => {
  crearEntorno()
  assertEquals((await llamar({ accion: "tick" })).datos, { creadas: 0, enviadas: 0, fallidas: 0 })
})

Deno.test("tick revisa las reglas y despacha en la misma llamada", async () => {
  const { base } = crearEntorno({
    regla_alerta: [regla("ACUERDO_VENCIDO", { categoria: "Vencimientos", destinatarios: ["po"], hora_envio: "00:00" })],
    v_acuerdo: [{ id: 1, descripcion: "Entregar", origen: "", fecha_limite: "2020-01-01", estado: "Pendiente", responsable_id: null }],
  })
  const { datos } = await llamar({ accion: "tick" })
  assertEquals(datos, { creadas: 1, enviadas: 1, fallidas: 0 })
  assertEquals(base.filas("alerta_programada")[0].estado, "Enviada")
})

Deno.test("despachar devuelve el conteo de enviadas y fallidas", async () => {
  crearEntorno()
  assertEquals((await llamar({ accion: "despachar" })).datos, { enviadas: 0, fallidas: 0 })
})

Deno.test("item_guardado exige el resultado del guardado", async () => {
  crearEntorno()
  assertEquals((await llamar({ accion: "item_guardado" })).estado, 400)
  assertEquals((await llamar({ accion: "item_guardado", resultado: { id: "x" } })).estado, 400)
})

Deno.test("item_guardado devuelve el mensaje de las alertas generadas y las despacha", async () => {
  const { base } = crearEntorno({
    regla_alerta: [regla("BLOQUEO_NUEVO", { destinatarios: ["responsable"] })],
    v_persona: [luis],
    v_item: [item({ id: 10, bloqueado: true, motivo_bloqueo: "x", responsable_id: 1, responsable: "Luis" })],
  })
  const { datos } = await llamar({ accion: "item_guardado", resultado: { id: 10, antes: null, cambios: [], sin_cambios: false } })
  assertEquals(datos, { mensaje: "Alerta de bloqueante para 1 destinatario(s)." })
  assertEquals(base.filas("alerta_programada")[0].estado, "Enviada")
})

Deno.test("escalar sin bloqueante_id es 400", async () => {
  crearEntorno()
  assertEquals((await llamar({ accion: "escalar" })).estado, 400)
})

Deno.test("escalar un bloqueo que ya no está abierto es 400", async () => {
  crearEntorno({ regla_alerta: [regla("BLOQUEO_ESCALAR")], v_bloqueante_abierto: [] })
  const { estado, datos } = await llamar({ accion: "escalar", bloqueante_id: 99 })
  assertEquals(estado, 400)
  assertEquals(datos, { error: "Ese bloqueo ya no está abierto." })
})

Deno.test("escalar un bloqueo abierto envía el escalamiento y lo marca", async () => {
  const { base } = crearEntorno({
    regla_alerta: [regla("BLOQUEO_ESCALAR", { categoria: "Escalamientos", destinatarios: ["po"] })],
    v_bloqueante_abierto: [bloqueanteAbierto],
    bloqueante: [{ ...bloqueanteAbierto }],
    v_item: [item({ id: 105, codigo: "BL-005" })],
  })
  const { datos } = await llamar({ accion: "escalar", bloqueante_id: 5 })
  assertEquals(datos, { ok: true, mensaje: "Escalamiento enviado." })
  assertEquals(base.filas("alerta_programada")[0].estado, "Enviada")
  assert(base.filas("bloqueante")[0].escalado_en)
})

Deno.test("escalar sin destinatarios con correo avisa sin marcar el bloqueo", async () => {
  const { base } = crearEntorno({
    regla_alerta: [regla("BLOQUEO_ESCALAR", { destinatarios: ["lider_tecnico"] })],
    v_bloqueante_abierto: [bloqueanteAbierto],
    bloqueante: [{ ...bloqueanteAbierto }],
    v_item: [item({ id: 105 })],
  })
  const { datos } = await llamar({ accion: "escalar", bloqueante_id: 5 })
  assertEquals(datos, { ok: false, mensaje: "No hay destinatarios con correo válido." })
  assertEquals(base.filas("bloqueante")[0].escalado_en, null)
})

Deno.test("resumen encola y envía el resumen semanal a los destinatarios de la regla", async () => {
  const { base } = crearEntorno({
    regla_alerta: [regla("RESUMEN_SEMANAL", { categoria: "Resumen semanal", destinatarios: ["po"] })],
    v_item: [],
    v_bloqueante_abierto: [],
    nota: [],
    v_ceremonia: [],
  })
  const { datos } = await llamar({ accion: "resumen" })
  assertEquals(datos, { destinatarios: 1, mensaje: "Resumen enviado a 1 destinatario(s)." })
  const [alerta] = base.filas("alerta_programada")
  assertEquals(alerta.destinatarios, [PO.correo])
  assert(String(alerta.asunto).startsWith("[Resumen semanal] Plan de trabajo "))
})

Deno.test("resumen sin la regla configurada informa 0 destinatarios", async () => {
  crearEntorno({ v_item: [], v_bloqueante_abierto: [], nota: [], v_ceremonia: [] })
  const { datos } = await llamar({ accion: "resumen" })
  assertEquals(datos, { destinatarios: 0, mensaje: "Resumen enviado a 0 destinatario(s)." })
})

Deno.test("recordar exige la lista de ítems", async () => {
  crearEntorno()
  assertEquals((await llamar({ accion: "recordar" })).estado, 400)
  assertEquals((await llamar({ accion: "recordar", item_ids: "1,2" })).estado, 400)
})

Deno.test("recordar envía un correo por responsable y avisa si ya se había enviado hoy", async () => {
  crearEntorno({
    regla_alerta: [regla("VENCIMIENTO", { categoria: "Vencimientos", destinatarios: ["responsable"] })],
    v_persona: [luis],
    v_item: [
      item({ id: 1, responsable_id: 1, responsable: "Luis", fecha_compromiso: "2026-11-01", atraso_dias: 5 }),
      item({ id: 2, responsable_id: 1, responsable: "Luis", fecha_compromiso: "2026-11-02", atraso_dias: 4 }),
    ],
  })
  assertEquals((await llamar({ accion: "recordar", item_ids: [1, 2] })).datos, {
    correos: 1,
    mensaje: "1 correo(s) de recordatorio enviados (uno por responsable).",
  })
  assertEquals((await llamar({ accion: "recordar", item_ids: [1, 2] })).datos, {
    correos: 0,
    mensaje: "Hoy ya se había enviado el recordatorio a estos responsables.",
  })
})

const ceremonia: Fila = {
  id: 3,
  tipo: "Demo",
  titulo: "Demo AIR-E",
  fecha_hora: "2026-11-10T14:00:00Z",
  duracion_min: 45,
  lugar: "Teams",
  audiencia: "equipo",
  notas: "",
  cliente: "AIR-E",
  invitacion_enviada: false,
}

Deno.test("invitar_ceremonia valida el id y que la ceremonia exista", async () => {
  crearEntorno({ v_ceremonia: [] })
  assertEquals((await llamar({ accion: "invitar_ceremonia" })).estado, 400)
  const { estado, datos } = await llamar({ accion: "invitar_ceremonia", ceremonia_id: 99 })
  assertEquals(estado, 400)
  assertEquals(datos, { error: "La ceremonia no existe" })
})

Deno.test("invitar_ceremonia envía a la audiencia y al PO y marca la invitación", async () => {
  const { base } = crearEntorno({
    regla_alerta: [regla("CEREMONIA", { categoria: "Ceremonias", destinatarios: ["audiencia"] })],
    v_persona: [luis, persona({ correo: "cliente@x.com", tipo: "stakeholder" })],
    v_ceremonia: [ceremonia],
    ceremonia: [{ ...ceremonia }],
  })
  const { datos } = await llamar({ accion: "invitar_ceremonia", ceremonia_id: 3 })
  assertEquals(datos, { destinatarios: 2 })
  const [alerta] = base.filas("alerta_programada")
  assertEquals(alerta.destinatarios, ["luis@ises.com.co", PO.correo])
  assertEquals(alerta.asunto, "[Invitación] Demo AIR-E · 2026-11-10 09:00")
  assertStringIncludes(String(alerta.cuerpo_html), "45 min")
  assertEquals(base.filas("ceremonia")[0].invitacion_enviada, true)
})

Deno.test("reenviar la invitación genera un correo nuevo", async () => {
  const { base } = crearEntorno({ v_persona: [luis], v_ceremonia: [ceremonia], ceremonia: [{ ...ceremonia }] })
  await llamar({ accion: "invitar_ceremonia", ceremonia_id: 3 })
  await new Promise((resolver) => setTimeout(resolver, 5))
  await llamar({ accion: "invitar_ceremonia", ceremonia_id: 3 })
  assertEquals(base.filas("alerta_programada").length, 2)
})

Deno.test("destinatarios por regla resuelve los roles de la regla para el ítem", async () => {
  crearEntorno({
    regla_alerta: [regla("BLOQUEO_NUEVO", { destinatarios: ["responsable", "po"] })],
    v_persona: [luis],
    v_item: [item({ id: 10, responsable_id: 1 })],
  })
  const { datos } = await llamar({ accion: "destinatarios", regla_codigo: "BLOQUEO_NUEVO", item_id: 10 })
  assertEquals((datos as unknown as { correo: string }[]).map((d) => d.correo), ["luis@ises.com.co", PO.correo])
})

Deno.test("destinatarios de la regla CEREMONIA usa la audiencia indicada y al PO", async () => {
  crearEntorno({
    regla_alerta: [regla("CEREMONIA", { categoria: "Ceremonias", destinatarios: ["audiencia"] })],
    v_persona: [luis],
  })
  const { datos } = await llamar({ accion: "destinatarios", regla_codigo: "CEREMONIA", audiencia: "equipo" })
  assertEquals((datos as unknown as { correo: string }[]).map((d) => d.correo), ["luis@ises.com.co", PO.correo])
})

Deno.test("destinatarios con roles explícitos y con una regla inexistente", async () => {
  crearEntorno({ v_persona: [luis] })
  const { datos } = await llamar({ accion: "destinatarios", roles: ["po"], categoria: "Bloqueantes" })
  assertEquals((datos as unknown as { correo: string }[]).map((d) => d.correo), [PO.correo])
  const inexistente = await llamar({ accion: "destinatarios", regla_codigo: "NO_EXISTE" })
  assertEquals(inexistente.estado, 400)
  assertEquals((await llamar({ accion: "destinatarios", roles: "po" })).estado, 400)
})

Deno.test("las respuestas nunca incluyen la contraseña SMTP", async () => {
  crearEntorno({ smtp_config: [smtp({ password: "super-secreta" })] })
  const { datos } = await llamar({ accion: "despachar" })
  assertEquals(JSON.stringify(datos).includes("super-secreta"), false)
})
