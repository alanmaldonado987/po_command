import { assertEquals } from "jsr:@std/assert@1"
import { ErrorClickUp } from "../_shared/clickup_api.ts"
import { firmar } from "../_shared/clickup_firma.ts"
import { manejador } from "../clickup-webhook/manejador.ts"
import { configClickUp, entornoClickUp, tareaClickUp } from "./clickup_falso.ts"

const SECRETO = "secreto-del-webhook"

type Datos = Record<string, unknown>

async function enviar(cuerpo: string, firma: string | null, metodo = "POST") {
  const cabeceras: Record<string, string> = firma === null ? {} : { "X-Signature": firma }
  const respuesta = await manejador(
    new Request("http://localhost/functions/v1/clickup-webhook", { method: metodo, body: metodo === "POST" ? cuerpo : undefined, headers: cabeceras }),
  )
  return { estado: respuesta.status, datos: (await respuesta.json()) as Datos }
}

const firmado = async (evento: Datos) => {
  const cuerpo = JSON.stringify(evento)
  return enviar(cuerpo, await firmar(cuerpo, SECRETO))
}

const preparar = (extra: Datos = {}) => {
  const entorno = entornoClickUp({ clickup_config: [configClickUp({ webhook_secret: SECRETO, webhook_id: "wh-1", ...extra })] })
  entorno.base.manejadoresRpc.aplicar_cambio_clickup = () => ({ resultado: "actualizado" })
  return entorno
}

const aplicaciones = (entorno: ReturnType<typeof preparar>) => entorno.base.rpcs.filter((r) => r.nombre === "aplicar_cambio_clickup")

Deno.test("OPTIONS responde 200 y otros métodos distintos de POST, 405", async () => {
  preparar()
  const opciones = await manejador(new Request("http://localhost/", { method: "OPTIONS" }))
  assertEquals(opciones.status, 200)
  assertEquals((await enviar("", null, "GET")).estado, 405)
})

Deno.test("rechaza con 401 las peticiones sin firma, con firma errónea o sin secreto configurado", async () => {
  const entorno = preparar()
  const cuerpo = JSON.stringify({ event: "taskUpdated", task_id: "T-1" })
  assertEquals((await enviar(cuerpo, null)).estado, 401)
  assertEquals((await enviar(cuerpo, "abc123")).estado, 401)
  assertEquals((await enviar(cuerpo, await firmar(cuerpo, "otro-secreto"))).estado, 401)
  assertEquals((await enviar(cuerpo.replace("T-1", "T-2"), await firmar(cuerpo, SECRETO))).estado, 401)
  assertEquals(aplicaciones(entorno).length, 0)
  const sinSecreto = preparar({ webhook_secret: "" })
  assertEquals((await enviar(cuerpo, await firmar(cuerpo, "x"))).estado, 401)
  assertEquals(aplicaciones(sinSecreto).length, 0)
})

Deno.test("con la integración deshabilitada acepta el evento sin procesarlo", async () => {
  const entorno = preparar({ habilitado: false })
  const { estado, datos } = await firmado({ event: "taskUpdated", task_id: "T-1" })
  assertEquals([estado, datos], [200, { ok: true, resultado: "deshabilitado" }])
  assertEquals(entorno.cliente.llamadas.length, 0)
})

Deno.test("taskUpdated lee la tarea completa y aplica el cambio en la app", async () => {
  const entorno = preparar()
  entorno.cliente.tareas.set("T-1", tareaClickUp({ id: "T-1", name: "Nombre nuevo" }))
  const { estado, datos } = await firmado({ event: "taskUpdated", task_id: "T-1", webhook_id: "wh-1" })
  assertEquals([estado, datos], [200, { ok: true, resultado: { resultado: "actualizado" } }])
  const [rpc] = aplicaciones(entorno)
  assertEquals((rpc.argumentos as { p_tarea: { name: string }; p_evento: string }).p_tarea.name, "Nombre nuevo")
  assertEquals((rpc.argumentos as { p_evento: string }).p_evento, "taskUpdated")
})

Deno.test("taskCreated y los eventos específicos de tarea también se procesan", async () => {
  const entorno = preparar()
  entorno.cliente.tareas.set("T-1", tareaClickUp({ id: "T-1" }))
  for (const evento of ["taskCreated", "taskStatusUpdated", "taskAssigneeUpdated", "taskDueDateUpdated", "taskTagUpdated", "taskMoved"]) {
    await firmado({ event: evento, task_id: "T-1" })
  }
  assertEquals(aplicaciones(entorno).map((r) => (r.argumentos as { p_evento: string }).p_evento), [
    "taskCreated",
    "taskStatusUpdated",
    "taskAssigneeUpdated",
    "taskDueDateUpdated",
    "taskTagUpdated",
    "taskMoved",
  ])
})

Deno.test("taskDeleted aplica la eliminación sin consultar la API de ClickUp", async () => {
  const entorno = preparar()
  await firmado({ event: "taskDeleted", task_id: "T-1" })
  assertEquals(entorno.cliente.llamadas.length, 0)
  assertEquals(aplicaciones(entorno)[0].argumentos, { p_tarea: { id: "T-1" }, p_evento: "taskDeleted", p_cliente_id: null })
})

Deno.test("si la tarea ya no existe al consultarla se trata como eliminada", async () => {
  const entorno = preparar()
  const { estado } = await firmado({ event: "taskUpdated", task_id: "T-404" })
  assertEquals(estado, 200)
  assertEquals((aplicaciones(entorno)[0].argumentos as { p_evento: string }).p_evento, "taskDeleted")
})

Deno.test("ignora eventos que no son de tareas o que no traen task_id", async () => {
  const entorno = preparar()
  assertEquals((await firmado({ event: "listCreated", list_id: "L1" })).datos, { ok: true, resultado: "ignorado" })
  assertEquals((await firmado({ event: "taskUpdated" })).datos, { ok: true, resultado: "ignorado" })
  assertEquals((await firmado({})).datos, { ok: true, resultado: "ignorado" })
  assertEquals(aplicaciones(entorno).length, 0)
})

Deno.test("un error al procesar responde 200 con ok=false para que ClickUp no desactive el webhook", async () => {
  const entorno = preparar()
  entorno.cliente.fallar("tarea", new ErrorClickUp("Servidor caído", 500))
  const { estado, datos } = await firmado({ event: "taskUpdated", task_id: "T-1" })
  assertEquals(estado, 200)
  assertEquals(datos, { ok: false, error: "Servidor caído" })
})

Deno.test("un cuerpo firmado pero que no es JSON responde 200 con ok=false", async () => {
  preparar()
  const cuerpo = "no es json"
  const { estado, datos } = await enviar(cuerpo, await firmar(cuerpo, SECRETO))
  assertEquals(estado, 200)
  assertEquals(datos.ok, false)
})

Deno.test("taskPriorityUpdated lee la tarea con su prioridad y la aplica en la app", async () => {
  const entorno = preparar()
  entorno.cliente.tareas.set("T-1", tareaClickUp({ id: "T-1", priority: { id: "1", priority: "urgent" } }))
  const { estado } = await firmado({ event: "taskPriorityUpdated", task_id: "T-1", webhook_id: "wh-1" })
  assertEquals(estado, 200)
  const [rpc] = aplicaciones(entorno)
  const argumentos = rpc.argumentos as { p_evento: string; p_tarea: { priority: { id: string } } }
  assertEquals(argumentos.p_evento, "taskPriorityUpdated")
  assertEquals(argumentos.p_tarea.priority.id, "1")
})
