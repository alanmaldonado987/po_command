import { assertEquals } from "jsr:@std/assert@1"
import { ErrorClickUp } from "../_shared/clickup_api.ts"
import { sincronizar } from "../_shared/clickup_cola.ts"
import { msAIso, fechaAMs } from "../_shared/clickup_tarea.ts"
import type { Fila } from "./base_falsa.ts"
import { configClickUp, destino, entornoClickUp, filaCola, itemVinculable, tareaClickUp } from "./clickup_falso.ts"

const MIEMBROS = [
  { user: { id: 2, username: "lk", email: "LK@ises.com.co" } },
  { user: { id: 3, username: "dp", email: "dp@ises.com.co" } },
]

function preparar(opciones: { item?: Fila; cola?: Fila[]; datos?: Record<string, Fila[]> } = {}) {
  const item = itemVinculable(opciones.item)
  const entorno = entornoClickUp({
    item: [{ ...item }],
    v_item: [{ ...item }],
    clickup_cola: opciones.cola ?? [filaCola()],
    ...opciones.datos,
  })
  entorno.cliente.equiposActuales = [{ id: "EQ-1", name: "Ises", members: MIEMBROS }]
  return entorno
}

const fila = (entorno: ReturnType<typeof preparar>, tabla: string, indice = 0) => entorno.base.filas(tabla)[indice]

Deno.test("no hace nada si la integración está deshabilitada o sin token", async () => {
  const deshabilitada = preparar({ datos: { clickup_config: [configClickUp({ habilitado: false })] } })
  assertEquals(await sincronizar(), { procesadas: 0, errores: 0 })
  assertEquals(deshabilitada.cliente.llamadas.length, 0)
  assertEquals(deshabilitada.base.rpcs.length, 0)
  preparar({ datos: { clickup_config: [configClickUp({ token: "" })] } })
  assertEquals(await sincronizar(), { procesadas: 0, errores: 0 })
})

Deno.test("create: crea la tarea en la lista del cliente y vincula el ítem", async () => {
  const entorno = preparar({
    item: { responsable_correo: "lk@ises.com.co", plan_ini: "2026-03-01", fecha_compromiso: "2026-03-20" },
    datos: { clickup_destino: [destino({ cliente_id: 1, lista_id: "L-AIRE" }), destino({ id: 2, cliente_id: null, lista_id: "L-GENERAL" })] },
  })
  assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
  const [listaId, cuerpo] = entorno.cliente.llamadasDe("crearTarea")[0] as [string, Record<string, unknown>]
  assertEquals(listaId, "L-AIRE")
  assertEquals(cuerpo.name, "Mapa de rutas")
  assertEquals(cuerpo.status, "en desarrollo")
  assertEquals(cuerpo.assignees, [2])
  assertEquals(cuerpo.start_date, fechaAMs("2026-03-01"))
  const item = fila(entorno, "item")
  assertEquals(item.clickup_task_id, "T-1")
  assertEquals(item.clickup_url, "https://app.clickup.com/t/T-1")
  assertEquals(item.clickup_sync_en, msAIso(entorno.cliente.reloj))
  const cola = fila(entorno, "clickup_cola")
  assertEquals(cola.estado, "Procesada")
  assertEquals(cola.intentos, 1)
  assertEquals(cola.reservada_hasta, null)
  assertEquals(typeof cola.procesado_en, "string")
  assertEquals(fila(entorno, "clickup_config").ultimo_sync !== null, true)
})

Deno.test("create: usa el destino por defecto cuando el cliente no tiene lista propia", async () => {
  const entorno = preparar({
    item: { cliente_id: 7, cliente: "NUEVO" },
    datos: { clickup_destino: [destino({ cliente_id: 1, lista_id: "L-AIRE" }), destino({ id: 2, cliente_id: null, lista_id: "L-GENERAL" })] },
  })
  await sincronizar()
  assertEquals(entorno.cliente.llamadasDe("crearTarea")[0][0], "L-GENERAL")
})

Deno.test("create: sin ningún destino falla de inmediato y de forma permanente con un mensaje claro", async () => {
  const entorno = preparar({ datos: { clickup_destino: [] } })
  assertEquals(await sincronizar(), { procesadas: 0, errores: 1 })
  const cola = fila(entorno, "clickup_cola")
  assertEquals(cola.estado, "Fallida")
  assertEquals(cola.error, "Sin destino configurado para (sin tablero) / AIR-E")
  assertEquals(entorno.cliente.llamadasDe("crearTarea").length, 0)
})

Deno.test("create: si ClickUp rechaza el estado, reintenta sin estado y la tarea queda creada", async () => {
  const entorno = preparar()
  entorno.cliente.fallar("crearTarea", new ErrorClickUp("Status does not exist", 400, "CRTSK_001"))
  assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
  const llamadas = entorno.cliente.llamadasDe("crearTarea")
  assertEquals(llamadas.length, 2)
  assertEquals("status" in (llamadas[0][1] as object), true)
  assertEquals("status" in (llamadas[1][1] as object), false)
  assertEquals(fila(entorno, "item").clickup_task_id, "T-1")
})

Deno.test("create: un 400 que no es de estado no se reintenta y queda fallido", async () => {
  const entorno = preparar()
  entorno.cliente.fallar("crearTarea", new ErrorClickUp("Name is required", 400))
  assertEquals(await sincronizar(), { procesadas: 0, errores: 1 })
  assertEquals(entorno.cliente.llamadasDe("crearTarea").length, 1)
  assertEquals(fila(entorno, "clickup_cola").estado, "Fallida")
})

Deno.test("create: una fila de un ítem que ya no existe se da por procesada sin llamar a ClickUp", async () => {
  const entorno = preparar({ datos: { v_item: [] } })
  assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
  assertEquals(entorno.cliente.llamadas.length, 0)
})

Deno.test("resuelve el asignado contra los miembros del equipo una sola vez", async () => {
  const entorno = preparar({
    item: { responsable_correo: "dp@ises.com.co" },
    cola: [filaCola({ id: 1, item_id: 10 }), filaCola({ id: 2, item_id: 11 })],
    datos: {
      v_item: [itemVinculable({ responsable_correo: "dp@ises.com.co" }), itemVinculable({ id: 11, responsable_correo: "dp@ises.com.co" })],
      item: [itemVinculable({ responsable_correo: "dp@ises.com.co" }), itemVinculable({ id: 11 })],
    },
  })
  await sincronizar()
  assertEquals(entorno.cliente.llamadasDe("crearTarea").map((l) => (l[1] as Record<string, unknown>).assignees), [[3], [3]])
  assertEquals(entorno.cliente.llamadasDe("equipos").length, 1)
})

Deno.test("un responsable sin usuario en ClickUp deja la tarea sin asignados", async () => {
  const entorno = preparar({ item: { responsable_correo: "nadie@otra.com" } })
  await sincronizar()
  assertEquals((entorno.cliente.llamadasDe("crearTarea")[0][1] as Record<string, unknown>).assignees, [])
})

Deno.test("update: reemplaza asignados, sincroniza etiquetas gestionadas y vuelve a leer la tarea", async () => {
  const entorno = preparar({
    item: { clickup_task_id: "T-9", responsable_correo: "lk@ises.com.co", estado: "Terminado, en etapa de pruebas" },
    cola: [filaCola({ accion: "update" })],
  })
  entorno.cliente.tareas.set(
    "T-9",
    tareaClickUp({
      id: "T-9",
      assignees: [{ id: 1, username: "x", email: "x@y.co" }, { id: 2, username: "lk", email: "lk@ises.com.co" }],
      tags: [{ name: "mobile" }, { name: "bloqueado" }, { name: "urgente" }],
    }),
  )
  assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
  const [id, cuerpo] = entorno.cliente.llamadasDe("actualizarTarea")[0] as [string, Record<string, unknown>]
  assertEquals(id, "T-9")
  assertEquals(cuerpo.assignees, { add: [], rem: [1] })
  assertEquals(cuerpo.status, "validación")
  assertEquals(entorno.cliente.llamadasDe("agregarEtiqueta").map((l) => l[1]), ["Web", "Desarrollo"])
  assertEquals(entorno.cliente.llamadasDe("quitarEtiqueta").map((l) => l[1]), ["mobile", "bloqueado"])
  assertEquals(entorno.cliente.llamadasDe("tarea").length, 2)
  assertEquals(fila(entorno, "item").clickup_sync_en, msAIso(entorno.cliente.reloj))
  assertEquals(fila(entorno, "clickup_cola").estado, "Procesada")
})

Deno.test("update: sin cambios de etiquetas no vuelve a leer la tarea", async () => {
  const entorno = preparar({ item: { clickup_task_id: "T-9" }, cola: [filaCola({ accion: "update" })] })
  entorno.cliente.tareas.set("T-9", tareaClickUp({ id: "T-9", tags: [{ name: "Web" }, { name: "Desarrollo" }] }))
  await sincronizar()
  assertEquals(entorno.cliente.llamadasDe("tarea").length, 1)
  assertEquals(entorno.cliente.llamadasDe("agregarEtiqueta").length, 0)
})

Deno.test("update: una fila de create sobre un ítem ya vinculado actualiza en vez de duplicar", async () => {
  const entorno = preparar({ item: { clickup_task_id: "T-9" }, cola: [filaCola({ accion: "create" })] })
  entorno.cliente.tareas.set("T-9", tareaClickUp({ id: "T-9" }))
  await sincronizar()
  assertEquals(entorno.cliente.llamadasDe("crearTarea").length, 0)
  assertEquals(entorno.cliente.llamadasDe("actualizarTarea").length, 1)
})

Deno.test("update: una fila update de un ítem sin vincular crea la tarea", async () => {
  const entorno = preparar({ cola: [filaCola({ accion: "update" })] })
  await sincronizar()
  assertEquals(entorno.cliente.llamadasDe("crearTarea").length, 1)
})

Deno.test("update: si la tarea ya no existe en ClickUp se aplica la eliminación en la app", async () => {
  const entorno = preparar({ item: { clickup_task_id: "T-404" }, cola: [filaCola({ accion: "update" })] })
  assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
  const rpc = entorno.base.rpcs.find((r) => r.nombre === "aplicar_cambio_clickup")
  assertEquals(rpc?.argumentos, { p_tarea: { id: "T-404" }, p_evento: "taskDeleted", p_cliente_id: null })
  assertEquals(entorno.cliente.llamadasDe("actualizarTarea").length, 0)
})

Deno.test("update: si la tarea está archivada en ClickUp se reconcilia en la app y no se escribe", async () => {
  const entorno = preparar({ item: { clickup_task_id: "T-9" }, cola: [filaCola({ accion: "update" })] })
  entorno.cliente.tareas.set("T-9", tareaClickUp({ id: "T-9", archived: true }))
  await sincronizar()
  const rpc = entorno.base.rpcs.find((r) => r.nombre === "aplicar_cambio_clickup")
  assertEquals((rpc?.argumentos as { p_evento: string }).p_evento, "reconciliar")
  assertEquals(entorno.cliente.llamadasDe("actualizarTarea").length, 0)
})

Deno.test("archive: archiva la tarea vinculada y deja la fila procesada", async () => {
  const entorno = preparar({
    item: { clickup_task_id: "T-9", eliminado_en: "2026-03-01T00:00:00Z" },
    cola: [filaCola({ accion: "archive" })],
    datos: { v_item: [] },
  })
  entorno.cliente.tareas.set("T-9", tareaClickUp({ id: "T-9" }))
  assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
  assertEquals(entorno.cliente.llamadasDe("actualizarTarea")[0], ["T-9", { archived: true }])
  assertEquals(fila(entorno, "clickup_cola").estado, "Procesada")
})

Deno.test("archive: un ítem sin tarea o una tarea ya borrada no es un error", async () => {
  const sinTarea = preparar({ cola: [filaCola({ accion: "archive" })], datos: { v_item: [] } })
  assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
  assertEquals(sinTarea.cliente.llamadas.length, 0)
  const borrada = preparar({ item: { clickup_task_id: "T-404" }, cola: [filaCola({ accion: "archive" })], datos: { v_item: [] } })
  borrada.cliente.fallar("actualizarTarea", new ErrorClickUp("Task not found", 404))
  assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
})

Deno.test("un error transitorio deja la fila pendiente y la marca fallida al tercer intento", async () => {
  const entorno = preparar({ item: { clickup_task_id: "T-9" }, cola: [filaCola({ accion: "update" })] })
  entorno.cliente.tareas.set("T-9", tareaClickUp({ id: "T-9" }))
  entorno.cliente.fallar("tarea", new ErrorClickUp("Bad gateway", 502), new ErrorClickUp("Bad gateway", 502), new ErrorClickUp("Bad gateway", 502))
  for (const [intentos, estado] of [[1, "Pendiente"], [2, "Pendiente"], [3, "Fallida"]] as const) {
    await sincronizar()
    const cola = fila(entorno, "clickup_cola")
    assertEquals([cola.intentos, cola.estado, cola.reservada_hasta], [intentos, estado, null])
    assertEquals(cola.error, "Bad gateway")
  }
})

Deno.test("un error 4xx permanente deja la fila fallida en el primer intento", async () => {
  const entorno = preparar({ item: { clickup_task_id: "T-9" }, cola: [filaCola({ accion: "update" })] })
  entorno.cliente.tareas.set("T-9", tareaClickUp({ id: "T-9" }))
  entorno.cliente.fallar("actualizarTarea", new ErrorClickUp("Forbidden", 403))
  assertEquals(await sincronizar(), { procesadas: 0, errores: 1 })
  assertEquals(fila(entorno, "clickup_cola").estado, "Fallida")
})

Deno.test("un fallo no detiene el resto de la cola", async () => {
  const entorno = preparar({
    cola: [filaCola({ id: 1, item_id: 10 }), filaCola({ id: 2, item_id: 11 })],
    datos: { v_item: [itemVinculable(), itemVinculable({ id: 11, funcionalidad: "Otra", titulo: "Otra" })] },
  })
  entorno.cliente.fallar("crearTarea", new ErrorClickUp("Servidor caído", 500))
  assertEquals(await sincronizar(), { procesadas: 1, errores: 1 })
  assertEquals(entorno.base.filas("clickup_cola").map((f) => f.estado), ["Pendiente", "Procesada"])
})

Deno.test("procesa las filas en orden de id", async () => {
  const entorno = preparar({
    cola: [filaCola({ id: 5, item_id: 11 }), filaCola({ id: 2, item_id: 10 })],
    datos: { v_item: [itemVinculable(), itemVinculable({ id: 11, titulo: "Segunda" })] },
  })
  await sincronizar()
  assertEquals(entorno.cliente.llamadasDe("crearTarea").map((l) => (l[1] as Record<string, unknown>).name), ["Mapa de rutas", "Segunda"])
})

Deno.test("al agotar el presupuesto de tiempo libera las filas que quedaron sin procesar", async () => {
  const entorno = preparar({
    cola: [filaCola({ id: 1, item_id: 10 }), filaCola({ id: 2, item_id: 11 }), filaCola({ id: 3, item_id: 12 })],
    datos: { v_item: [itemVinculable(), itemVinculable({ id: 11 }), itemVinculable({ id: 12 })] },
  })
  let reloj = 0
  const resultado = await sincronizar(() => (reloj += 60_000))
  assertEquals(resultado, { procesadas: 1, errores: 0 })
  assertEquals(entorno.base.filas("clickup_cola").map((f) => [f.estado, f.reservada_hasta]), [
    ["Procesada", null],
    ["Pendiente", null],
    ["Pendiente", null],
  ])
})

Deno.test("create: envía la prioridad del ítem como número de ClickUp", async () => {
  const entorno = preparar({
    item: { prioridad: "Urgente" },
    datos: { clickup_destino: [destino({ cliente_id: 1, lista_id: "L-AIRE" })] },
  })
  await sincronizar()
  const [, cuerpo] = entorno.cliente.llamadasDe("crearTarea")[0] as [string, Record<string, unknown>]
  assertEquals(cuerpo.priority, 1)
})

Deno.test("update: cambia la prioridad solo si difiere de la de la tarea y la limpia con null si se borró", async () => {
  const cambia = preparar({ item: { clickup_task_id: "T-9", prioridad: "Baja" }, cola: [filaCola({ accion: "update" })] })
  cambia.cliente.tareas.set("T-9", tareaClickUp({ id: "T-9", priority: { id: "2", priority: "high" } }))
  await sincronizar()
  assertEquals((cambia.cliente.llamadasDe("actualizarTarea")[0][1] as Record<string, unknown>).priority, 4)

  const igual = preparar({ item: { clickup_task_id: "T-9", prioridad: "Alta" }, cola: [filaCola({ accion: "update" })] })
  igual.cliente.tareas.set("T-9", tareaClickUp({ id: "T-9", priority: { id: "2", priority: "high" } }))
  await sincronizar()
  assertEquals("priority" in (igual.cliente.llamadasDe("actualizarTarea")[0][1] as Record<string, unknown>), false)

  const borrada = preparar({ item: { clickup_task_id: "T-9", prioridad: null }, cola: [filaCola({ accion: "update" })] })
  borrada.cliente.tareas.set("T-9", tareaClickUp({ id: "T-9", priority: { id: "3", priority: "normal" } }))
  await sincronizar()
  assertEquals((borrada.cliente.llamadasDe("actualizarTarea")[0][1] as Record<string, unknown>).priority, null)
})
