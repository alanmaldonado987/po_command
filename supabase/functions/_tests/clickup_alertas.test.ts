import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1"
import { alertarCambioDeClickUp, crearLimiteAlertas, despacharSinFallar, MAX_ITEMS_CON_ALERTAS } from "../_shared/clickup_alertas.ts"
import { reconciliar } from "../_shared/clickup_reconciliar.ts"
import type { ResultadoCambio } from "../_shared/clickup_tipos.ts"
import type { ResultadoGuardado } from "../_shared/tipos.ts"
import { firmar } from "../_shared/clickup_firma.ts"
import { manejador } from "../clickup-webhook/manejador.ts"
import type { Fila } from "./base_falsa.ts"
import { configClickUp, destino, entornoClickUp, tareaClickUp } from "./clickup_falso.ts"
import { item, persona, regla } from "./entorno.ts"

const SECRETO = "secreto-del-webhook"
const luis = persona({ id: 1, nombre: "Luis", correo: "luis@ises.com.co" })

const reglasDeAviso = (): Fila[] => [
  regla("BLOQUEO_NUEVO"),
  regla("BLOQUEO_RESUELTO"),
  regla("REPROGRAMACION", { categoria: "Reprogramaciones" }),
]

const itemsDeAlerta = (cantidad: number, bloqueado = true): Fila[] =>
  Array.from({ length: cantidad }, (_, indice) =>
    item({ id: indice + 1, codigo: `BL-${String(indice + 1).padStart(3, "0")}`, responsable_id: 1, responsable: "Luis", bloqueado }),
  )

const guardado = (id: number, extra: Partial<ResultadoGuardado> = {}): ResultadoGuardado => ({
  id,
  antes: { bloqueado: false, motivo_bloqueo: "" },
  cambios: [],
  sin_cambios: false,
  bloqueado: false,
  ...extra,
})

const cambio = (resultado: ResultadoCambio["resultado"], datos: ResultadoGuardado | undefined): ResultadoCambio => ({
  resultado,
  item_id: datos?.id,
  guardado: datos,
})

const bloqueo = (id: number) => guardado(id, { bloqueado: true })
const desbloqueo = (id: number) => guardado(id, { antes: { bloqueado: true, motivo_bloqueo: "Falta API" }, bloqueado: false })
const reprogramacion = (id: number) => guardado(id, { cambios: [{ campo: "plan_fin", antes: "2026-01-01", despues: "2026-01-15" }] })

type Entorno = ReturnType<typeof entornoClickUp>

function preparar(cantidadItems = 3, datos: Record<string, Fila[]> = {}): Entorno {
  return entornoClickUp({
    clickup_config: [configClickUp({ webhook_secret: SECRETO, webhook_id: "wh-1" })],
    regla_alerta: reglasDeAviso(),
    v_persona: [luis],
    v_item: itemsDeAlerta(cantidadItems),
    alerta_programada: [],
    ...datos,
  })
}

function responderCon(entorno: Entorno, porTarea: Record<string, ResultadoCambio>) {
  entorno.base.manejadoresRpc.aplicar_cambio_clickup = (argumentos) => {
    const { p_tarea } = argumentos as { p_tarea: { id: string } }
    return porTarea[p_tarea.id] ?? { resultado: "sin_cambios" }
  }
}

async function enviarEvento(evento: Record<string, unknown>) {
  const cuerpo = JSON.stringify(evento)
  const respuesta = await manejador(
    new Request("http://localhost/", { method: "POST", body: cuerpo, headers: { "X-Signature": await firmar(cuerpo, SECRETO) } }),
  )
  return (await respuesta.json()) as Record<string, unknown>
}

const alertas = (entorno: Entorno) => entorno.base.filas("alerta_programada")
const reglasEncoladas = (entorno: Entorno) => alertas(entorno).map((alerta) => alerta.regla_codigo)

function tareaEnClickUp(entorno: Entorno, id: string, dateUpdated = "1800000000500") {
  const tarea = tareaClickUp({ id, date_updated: dateUpdated })
  entorno.cliente.tareas.set(id, tarea)
  return tarea
}

Deno.test("webhook: bloquear una tarea en ClickUp avisa del bloqueo, lo despacha e indica el origen", async () => {
  const entorno = preparar()
  tareaEnClickUp(entorno, "T-1")
  responderCon(entorno, { "T-1": cambio("actualizado", bloqueo(1)) })
  const respuesta = await enviarEvento({ event: "taskUpdated", task_id: "T-1" })
  assertEquals(respuesta.ok, true)
  assertEquals(reglasEncoladas(entorno), ["BLOQUEO_NUEVO"])
  const [alerta] = alertas(entorno)
  assertEquals(alerta.clave_unica, "CK:1:1800000000500:BLOQUEO_NUEVO")
  assertEquals(alerta.estado, "Enviada")
  assertStringIncludes(String(alerta.cuerpo_html), "Cambio hecho en")
  assertStringIncludes(String(alerta.cuerpo_html), "ClickUp")
  assertEquals(alerta.destinatarios, ["luis@ises.com.co", "po@ises.com.co"])
})

Deno.test("webhook: la respuesta no expone el detalle del guardado", async () => {
  const entorno = preparar()
  tareaEnClickUp(entorno, "T-1")
  responderCon(entorno, { "T-1": cambio("actualizado", bloqueo(1)) })
  const respuesta = await enviarEvento({ event: "taskUpdated", task_id: "T-1" })
  assertEquals(respuesta.resultado, { resultado: "actualizado", item_id: 1 })
})

Deno.test("webhook: desbloquear en ClickUp avisa de que el bloqueo quedó resuelto", async () => {
  const entorno = preparar(1, { v_item: itemsDeAlerta(1, false) })
  tareaEnClickUp(entorno, "T-1")
  responderCon(entorno, { "T-1": cambio("actualizado", desbloqueo(1)) })
  await enviarEvento({ event: "taskTagUpdated", task_id: "T-1" })
  assertEquals(reglasEncoladas(entorno), ["BLOQUEO_RESUELTO"])
  assertStringIncludes(String(alertas(entorno)[0].cuerpo_html), "Falta API")
})

Deno.test("webhook: cambiar la fecha en ClickUp avisa de la reprogramación con la fecha antes → después", async () => {
  const entorno = preparar(1, { v_item: itemsDeAlerta(1, false) })
  tareaEnClickUp(entorno, "T-1")
  responderCon(entorno, { "T-1": cambio("actualizado", reprogramacion(1)) })
  await enviarEvento({ event: "taskDueDateUpdated", task_id: "T-1" })
  assertEquals(reglasEncoladas(entorno), ["REPROGRAMACION"])
  assertStringIncludes(String(alertas(entorno)[0].cuerpo_html), "01/01/2026 → 15/01/2026")
})

Deno.test("webhook: bloqueo y cambio de fecha en el mismo evento envían los dos avisos", async () => {
  const entorno = preparar()
  tareaEnClickUp(entorno, "T-1")
  const ambos = guardado(1, { bloqueado: true, cambios: reprogramacion(1).cambios })
  responderCon(entorno, { "T-1": cambio("actualizado", ambos) })
  await enviarEvento({ event: "taskUpdated", task_id: "T-1" })
  assertEquals(reglasEncoladas(entorno).sort(), ["BLOQUEO_NUEVO", "REPROGRAMACION"])
})

Deno.test("webhook: no avisa en creaciones, sin cambios, ignorados ni cuando solo cambia el estado", async () => {
  const casos: ResultadoCambio[] = [
    cambio("creado", bloqueo(1)),
    cambio("sin_cambios", undefined),
    cambio("ignorado", undefined),
    cambio("archivado", undefined),
    cambio("actualizado", guardado(1)),
    cambio("actualizado", undefined),
  ]
  for (const caso of casos) {
    const entorno = preparar()
    tareaEnClickUp(entorno, "T-1")
    responderCon(entorno, { "T-1": caso })
    await enviarEvento({ event: "taskUpdated", task_id: "T-1" })
    assertEquals(alertas(entorno).length, 0, `no debe avisar con ${caso.resultado}`)
    assertEquals(entorno.base.filas("notificacion_log").length, 0)
  }
})

Deno.test("webhook: taskDeleted no genera avisos", async () => {
  const entorno = preparar()
  responderCon(entorno, { "T-1": cambio("archivado", undefined) })
  await enviarEvento({ event: "taskDeleted", task_id: "T-1" })
  assertEquals(alertas(entorno).length, 0)
})

Deno.test("webhook: el mismo cambio visto dos veces no manda el correo dos veces", async () => {
  const entorno = preparar()
  tareaEnClickUp(entorno, "T-1")
  responderCon(entorno, { "T-1": cambio("actualizado", bloqueo(1)) })
  await enviarEvento({ event: "taskUpdated", task_id: "T-1" })
  await enviarEvento({ event: "taskTagUpdated", task_id: "T-1" })
  assertEquals(alertas(entorno).length, 1)
})

Deno.test("webhook: un cambio posterior del mismo ítem sí vuelve a avisar", async () => {
  const entorno = preparar()
  const tarea = tareaEnClickUp(entorno, "T-1", "1800000000500")
  responderCon(entorno, { "T-1": cambio("actualizado", bloqueo(1)) })
  await enviarEvento({ event: "taskUpdated", task_id: "T-1" })
  tarea.date_updated = "1800000009999"
  await enviarEvento({ event: "taskUpdated", task_id: "T-1" })
  assertEquals(alertas(entorno).length, 2)
})

Deno.test("webhook: un fallo al encolar el correo no rompe la sincronización", async () => {
  const entorno = preparar()
  tareaEnClickUp(entorno, "T-1")
  responderCon(entorno, { "T-1": cambio("actualizado", bloqueo(1)) })
  entorno.base.fallar("alerta_programada", "insert", "sin espacio en disco")
  const respuesta = await enviarEvento({ event: "taskUpdated", task_id: "T-1" })
  assertEquals(respuesta.ok, true)
  assertEquals(respuesta.resultado, { resultado: "actualizado", item_id: 1 })
})

Deno.test("webhook: un correo que no sale no impide aceptar el evento", async () => {
  const entorno = preparar()
  tareaEnClickUp(entorno, "T-1")
  responderCon(entorno, { "T-1": cambio("actualizado", bloqueo(1)) })
  entorno.transporte.error = new Error("SMTP caído")
  entorno.base.filas("smtp_config")[0].dry_run = false
  const respuesta = await enviarEvento({ event: "taskUpdated", task_id: "T-1" })
  assertEquals(respuesta.ok, true)
  assertEquals(alertas(entorno).length, 1)
})

Deno.test("reconciliar: avisa de bloqueos, desbloqueos y reprogramaciones y despacha una vez al final", async () => {
  const [uno, dos, tres] = itemsDeAlerta(3)
  const entorno = preparar(3, {
    clickup_destino: [destino({ id: 1, lista_id: "L-1" })],
    v_item: [uno, { ...dos, bloqueado: false }, { ...tres, bloqueado: false }],
  })
  entorno.cliente.tareasPorLista = {
    "L-1": [tareaClickUp({ id: "A" }), tareaClickUp({ id: "B" }), tareaClickUp({ id: "C" })],
  }
  responderCon(entorno, {
    A: cambio("actualizado", bloqueo(1)),
    B: cambio("actualizado", desbloqueo(2)),
    C: cambio("actualizado", reprogramacion(3)),
  })
  assertEquals(await reconciliar(), { creadas: 0, actualizadas: 3, archivadas: 0 })
  assertEquals(reglasEncoladas(entorno).sort(), ["BLOQUEO_NUEVO", "BLOQUEO_RESUELTO", "REPROGRAMACION"])
  assertEquals(alertas(entorno).every((alerta) => alerta.estado === "Enviada"), true)
})

Deno.test("reconciliar: no avisa de ítems creados ni de cambios sin novedades", async () => {
  const entorno = preparar(2, { clickup_destino: [destino({ id: 1, lista_id: "L-1" })] })
  entorno.cliente.tareasPorLista = { "L-1": [tareaClickUp({ id: "A" }), tareaClickUp({ id: "B" })] }
  responderCon(entorno, { A: cambio("creado", bloqueo(1)), B: cambio("actualizado", guardado(2)) })
  await reconciliar()
  assertEquals(alertas(entorno).length, 0)
})

Deno.test("reconciliar forzado nunca manda correos", async () => {
  const entorno = preparar(2, { clickup_destino: [destino({ id: 1, lista_id: "L-1" })] })
  entorno.cliente.tareasPorLista = { "L-1": [tareaClickUp({ id: "A" }), tareaClickUp({ id: "B" })] }
  responderCon(entorno, { A: cambio("actualizado", bloqueo(1)), B: cambio("actualizado", reprogramacion(2)) })
  assertEquals((await reconciliar(null, true)).actualizadas, 2)
  assertEquals(alertas(entorno).length, 0)
})

Deno.test("reconciliar respeta el tope de ítems con avisos por ejecución", async () => {
  const total = MAX_ITEMS_CON_ALERTAS + 4
  const entorno = preparar(total, { clickup_destino: [destino({ id: 1, lista_id: "L-1" })] })
  const tareas = Array.from({ length: total }, (_, indice) => tareaClickUp({ id: `T${indice + 1}`, date_updated: String(1800000000000 + indice) }))
  entorno.cliente.tareasPorLista = { "L-1": tareas }
  responderCon(entorno, Object.fromEntries(tareas.map((tarea, indice) => [tarea.id, cambio("actualizado", bloqueo(indice + 1))])))
  const resumen = await reconciliar()
  assertEquals(resumen.actualizadas, total)
  assertEquals(alertas(entorno).length, MAX_ITEMS_CON_ALERTAS)
})

Deno.test("reconciliar: dos pasadas sobre el mismo cambio no duplican el correo", async () => {
  const entorno = preparar(1, { clickup_destino: [destino({ id: 1, lista_id: "L-1" })] })
  entorno.cliente.tareasPorLista = { "L-1": [tareaClickUp({ id: "A", date_updated: "1800000000777" })] }
  responderCon(entorno, { A: cambio("actualizado", bloqueo(1)) })
  await reconciliar()
  await reconciliar()
  assertEquals(alertas(entorno).length, 1)
})

Deno.test("alertarCambioDeClickUp: los ítems sin novedades no consumen el tope", async () => {
  const entorno = preparar(1)
  const limite = crearLimiteAlertas(1)
  for (let i = 0; i < 20; i += 1) {
    assertEquals(await alertarCambioDeClickUp(cambio("actualizado", guardado(1)), { date_updated: String(i) }, limite), false)
  }
  assertEquals(limite.restante, 1)
  assertEquals(await alertarCambioDeClickUp(cambio("actualizado", bloqueo(1)), { date_updated: "99" }, limite), true)
  assertEquals([limite.restante, limite.avisados, limite.omitidas], [0, 1, 0])
  assertEquals(await alertarCambioDeClickUp(cambio("actualizado", bloqueo(1)), { date_updated: "100" }, limite), false)
  assertEquals(limite.omitidas, 1)
  assertEquals(alertas(entorno).length, 1)
})

Deno.test("alertarCambioDeClickUp: nunca lanza aunque falle el encolado", async () => {
  const entorno = preparar(1)
  entorno.base.fallar("alerta_programada", "insert", "sin espacio")
  assertEquals(await alertarCambioDeClickUp(cambio("actualizado", bloqueo(1)), { date_updated: "1" }), false)
})

Deno.test("despacharSinFallar no lanza aunque falle el despacho", async () => {
  const entorno = preparar(1)
  entorno.base.fallar("alerta_programada", "select", "base caída")
  await despacharSinFallar()
  assertEquals(alertas(entorno).length, 0)
})
