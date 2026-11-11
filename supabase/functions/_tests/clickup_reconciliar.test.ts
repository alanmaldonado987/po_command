import { assertEquals, assertRejects } from "jsr:@std/assert@1"
import { ErrorClickUp } from "../_shared/clickup_api.ts"
import { importarExistentes, reconciliar } from "../_shared/clickup_reconciliar.ts"
import { ErrorSolicitud } from "../_shared/respuesta.ts"
import type { ResultadoCambio } from "../_shared/clickup_tipos.ts"
import { configClickUp, destino, entornoClickUp, itemVinculable, tareaClickUp } from "./clickup_falso.ts"

type Entorno = ReturnType<typeof entornoClickUp>

function resultadosPorTarea(entorno: Entorno, resultados: Record<string, ResultadoCambio["resultado"]>) {
  entorno.base.manejadoresRpc.aplicar_cambio_clickup = (argumentos) => {
    const { p_tarea } = argumentos as { p_tarea: { id: string } }
    return { resultado: resultados[p_tarea.id] ?? "sin_cambios" }
  }
}

const aplicaciones = (entorno: Entorno) =>
  entorno.base.rpcs.filter((r) => r.nombre === "aplicar_cambio_clickup").map((r) => r.argumentos as Record<string, unknown>)

Deno.test("reconciliar no hace nada con la integración deshabilitada", async () => {
  const entorno = entornoClickUp({ clickup_config: [configClickUp({ habilitado: false })] })
  assertEquals(await reconciliar(), { creadas: 0, actualizadas: 0, archivadas: 0 })
  assertEquals(entorno.cliente.llamadas.length, 0)
})

Deno.test("reconciliar recorre cada lista destino una sola vez y cuenta los resultados", async () => {
  const entorno = entornoClickUp({
    clickup_destino: [destino({ id: 1, cliente_id: 1, lista_id: "L-1" }), destino({ id: 2, cliente_id: 2, lista_id: "L-1" }), destino({ id: 3, cliente_id: null, lista_id: "L-2" })],
  })
  entorno.cliente.tareasPorLista = {
    "L-1": [tareaClickUp({ id: "A" }), tareaClickUp({ id: "B" })],
    "L-2": [tareaClickUp({ id: "C" })],
  }
  resultadosPorTarea(entorno, { A: "creado", B: "actualizado", C: "creado" })
  assertEquals(await reconciliar(), { creadas: 2, actualizadas: 1, archivadas: 0 })
  assertEquals(entorno.cliente.llamadasDe("tareasDeLista").filter((l) => l[1] === false).map((l) => l[0]), ["L-1", "L-2"])
  assertEquals(aplicaciones(entorno).every((a) => a.p_evento === "reconciliar"), true)
  assertEquals(entorno.base.filas("clickup_config")[0].ultimo_sync !== null, true)
})

Deno.test("reconciliar sin forzar no envía p_forzar al aplicar los cambios", async () => {
  const entorno = entornoClickUp()
  entorno.cliente.tareasPorLista = { "L-1": [tareaClickUp({ id: "A" })] }
  resultadosPorTarea(entorno, { A: "sin_cambios" })
  await reconciliar()
  assertEquals(aplicaciones(entorno).some((a) => "p_forzar" in a), false)
})

Deno.test("reconciliar forzado envía p_forzar en las tareas activas y archivadas", async () => {
  const entorno = entornoClickUp({ clickup_destino: [destino({ id: 1, cliente_id: null, lista_id: "L-1" })] })
  entorno.cliente.tareasPorLista = { "L-1": [tareaClickUp({ id: "A" })] }
  entorno.cliente.archivadasPorLista = { "L-1": [tareaClickUp({ id: "Z" })] }
  resultadosPorTarea(entorno, { A: "actualizado", Z: "archivado" })
  assertEquals(await reconciliar(null, true), { creadas: 0, actualizadas: 1, archivadas: 1 })
  const enviadas = aplicaciones(entorno)
  assertEquals(enviadas.length, 2)
  assertEquals(enviadas.every((a) => a.p_forzar === true && a.p_evento === "reconciliar"), true)
})

Deno.test("reconciliar forzado no fuerza la verificación de tareas vinculadas ausentes", async () => {
  const entorno = entornoClickUp({ item: [itemVinculable({ clickup_task_id: "T-404" })] })
  entorno.cliente.tareasPorLista = { "L-1": [] }
  resultadosPorTarea(entorno, { "T-404": "archivado" })
  await reconciliar(null, true)
  assertEquals(aplicaciones(entorno)[0], { p_tarea: { id: "T-404" }, p_evento: "taskDeleted", p_cliente_id: null })
})

Deno.test("reconciliar envía las tareas archivadas marcadas como archivadas para eliminar sus ítems", async () => {
  const entorno = entornoClickUp()
  entorno.cliente.archivadasPorLista = { "L-1": [tareaClickUp({ id: "Z", archived: false })] }
  resultadosPorTarea(entorno, { Z: "archivado" })
  assertEquals(await reconciliar(), { creadas: 0, actualizadas: 0, archivadas: 1 })
  assertEquals((aplicaciones(entorno)[0].p_tarea as { archived: boolean }).archived, true)
})

Deno.test("reconciliar elimina el ítem cuya tarea vinculada ya no existe en ClickUp", async () => {
  const entorno = entornoClickUp({ item: [itemVinculable({ clickup_task_id: "T-404" })] })
  entorno.cliente.tareasPorLista = { "L-1": [] }
  resultadosPorTarea(entorno, { "T-404": "archivado" })
  assertEquals(await reconciliar(), { creadas: 0, actualizadas: 0, archivadas: 1 })
  assertEquals(aplicaciones(entorno)[0], { p_tarea: { id: "T-404" }, p_evento: "taskDeleted", p_cliente_id: null })
})

Deno.test("reconciliar no toca ítems cuya tarea existe en otra lista y sigue activa", async () => {
  const entorno = entornoClickUp({ item: [itemVinculable({ clickup_task_id: "T-otra" })] })
  entorno.cliente.tareas.set("T-otra", tareaClickUp({ id: "T-otra", list: { id: "OTRA" } }))
  assertEquals(await reconciliar(), { creadas: 0, actualizadas: 0, archivadas: 0 })
  assertEquals(aplicaciones(entorno), [])
})

Deno.test("reconciliar archiva el ítem si su tarea, fuera de las listas mapeadas, fue archivada", async () => {
  const entorno = entornoClickUp({ item: [itemVinculable({ clickup_task_id: "T-arch" })] })
  entorno.cliente.tareas.set("T-arch", tareaClickUp({ id: "T-arch", archived: true }))
  resultadosPorTarea(entorno, { "T-arch": "archivado" })
  assertEquals((await reconciliar()).archivadas, 1)
})

Deno.test("reconciliar ignora los ítems ya vistos en el listado y los eliminados", async () => {
  const entorno = entornoClickUp({
    item: [itemVinculable({ clickup_task_id: "T-1" }), itemVinculable({ id: 11, clickup_task_id: "T-2", eliminado_en: "2026-01-01T00:00:00Z" })],
  })
  entorno.cliente.tareasPorLista = { "L-1": [tareaClickUp({ id: "T-1" })] }
  resultadosPorTarea(entorno, {})
  await reconciliar()
  assertEquals(entorno.cliente.llamadasDe("tarea").length, 0)
})

Deno.test("reconciliar propaga errores distintos de 404 al verificar tareas ausentes", async () => {
  const entorno = entornoClickUp({ item: [itemVinculable({ clickup_task_id: "T-9" })] })
  entorno.cliente.fallar("tarea", new ErrorClickUp("Servidor caído", 500))
  await assertRejects(() => reconciliar(), ErrorClickUp, "Servidor caído")
})

Deno.test("reconciliar verifica como máximo 30 tareas ausentes por pasada", async () => {
  const items = Array.from({ length: 40 }, (_, i) => itemVinculable({ id: 100 + i, clickup_task_id: `T-${i}` }))
  const entorno = entornoClickUp({ item: items })
  for (let i = 0; i < 40; i += 1) entorno.cliente.tareas.set(`T-${i}`, tareaClickUp({ id: `T-${i}` }))
  await reconciliar()
  assertEquals(entorno.cliente.llamadasDe("tarea").length, 30)
})

Deno.test("importarExistentes crea ítems vinculados y cuenta solo los nuevos", async () => {
  const entorno = entornoClickUp()
  entorno.cliente.tareasPorLista = { "L-1": [tareaClickUp({ id: "A" }), tareaClickUp({ id: "B" }), tareaClickUp({ id: "C" })] }
  resultadosPorTarea(entorno, { A: "creado", B: "sin_cambios", C: "creado" })
  assertEquals(await importarExistentes("L-1", null), 2)
  assertEquals(aplicaciones(entorno).map((a) => a.p_evento), ["importar", "importar", "importar"])
})

Deno.test("importarExistentes pasa el cliente elegido a la función SQL", async () => {
  const entorno = entornoClickUp()
  entorno.cliente.tareasPorLista = { "L-NUEVA": [tareaClickUp({ id: "A" })] }
  resultadosPorTarea(entorno, { A: "creado" })
  assertEquals(await importarExistentes("L-NUEVA", 4), 1)
  assertEquals(aplicaciones(entorno)[0].p_cliente_id, 4)
})

Deno.test("importarExistentes exige cliente cuando la lista no es un destino configurado", async () => {
  entornoClickUp()
  await assertRejects(() => importarExistentes("L-DESCONOCIDA", null), ErrorSolicitud, "Elige el cliente")
})
