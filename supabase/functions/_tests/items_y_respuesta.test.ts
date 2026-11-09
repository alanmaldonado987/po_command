import { usarAutorizador } from "../_shared/autorizacion.ts"
usarAutorizador(() => Promise.resolve(true))
import { assertEquals, assertRejects } from "jsr:@std/assert@1"
import { correoValido } from "../_shared/destinatarios.ts"
import { itemsPorVencer, listarItemsAbiertos, listarItemsPorId, obtenerItem, ubicacion, venceSoloConPruebas } from "../_shared/items.ts"
import { ErrorSolicitud, exigir, manejar } from "../_shared/respuesta.ts"
import type { Item } from "../_shared/tipos.ts"
import { crearEntorno, item } from "./entorno.ts"

const comoItems = (...items: ReturnType<typeof item>[]): Item[] => items as unknown as Item[]

Deno.test("correoValido rechaza valores que no son texto sin lanzar excepciones", () => {
  for (const valor of [123, true, {}, [], Symbol.iterator]) assertEquals(correoValido(valor), false)
})

Deno.test("itemsPorVencer filtra hasta el tope inclusive, descarta sin fecha y ordena por fecha", () => {
  const lista = comoItems(
    item({ codigo: "C", fecha_compromiso: "2026-11-08" }),
    item({ codigo: "A", fecha_compromiso: "2026-10-01" }),
    item({ codigo: "X", fecha_compromiso: "2026-11-09" }),
    item({ codigo: "N", fecha_compromiso: null }),
    item({ codigo: "B", fecha_compromiso: "2026-11-01" }),
  )
  assertEquals(itemsPorVencer(lista, "2026-11-08").map((i) => i.codigo), ["A", "B", "C"])
})

Deno.test("venceSoloConPruebas aplica solo a 'Terminado, en etapa de pruebas' sin fin de pruebas", () => {
  const [sinPruebas, conPruebas, enCurso] = comoItems(
    item({ estado: "Terminado, en etapa de pruebas", plan_pruebas_fin: null }),
    item({ estado: "Terminado, en etapa de pruebas", plan_pruebas_fin: "2026-11-01" }),
    item({ estado: "En curso", plan_pruebas_fin: null }),
  )
  assertEquals(venceSoloConPruebas(sinPruebas), true)
  assertEquals(venceSoloConPruebas(conPruebas), false)
  assertEquals(venceSoloConPruebas(enCurso), false)
})

Deno.test("ubicacion arma las tres filas del correo con guiones para datos vacíos", () => {
  const [fila] = comoItems(item({ cliente: null, actividad: "SCR", modulo: null, funcionalidad: "", fase: "", alcance: "Web" }))
  assertEquals(ubicacion(fila), [
    ["Cliente · actividad", "- · SCR"],
    ["Módulo · funcionalidad", "- · -"],
    ["Fase · alcance", "- · Web"],
  ])
})

Deno.test("listarItemsAbiertos excluye terminados y suspendidos pero conserva 'en etapa de pruebas'", async () => {
  crearEntorno({
    v_item: [
      item({ id: 1, estado: "En curso" }),
      item({ id: 2, estado: "Terminado" }),
      item({ id: 3, estado: "Suspendido" }),
      item({ id: 4, estado: "Terminado, en etapa de pruebas" }),
      item({ id: 5, estado: "No iniciado" }),
    ],
  })
  assertEquals((await listarItemsAbiertos()).map((i) => i.id), [1, 4, 5])
})

Deno.test("listarItemsPorId trae solo los ítems pedidos y obtenerItem falla si no existe", async () => {
  crearEntorno({ v_item: [item({ id: 1 }), item({ id: 2 }), item({ id: 3 })] })
  assertEquals((await listarItemsPorId([1, 3])).map((i) => i.id), [1, 3])
  assertEquals((await listarItemsPorId([])).length, 0)
  assertEquals((await obtenerItem(2)).id, 2)
  await assertRejects(() => obtenerItem(99), Error)
})

Deno.test("exigir lanza ErrorSolicitud solo cuando la condición falla", () => {
  exigir(true, "no debe lanzar")
  exigir("texto", "no debe lanzar")
  let lanzado: unknown
  try {
    exigir(0, "falta algo")
  } catch (error) {
    lanzado = error
  }
  assertEquals(lanzado instanceof ErrorSolicitud, true)
  assertEquals((lanzado as Error).message, "falta algo")
})

Deno.test("manejar devuelve 500 para errores inesperados, también si lo lanzado no es un Error", async () => {
  const lanzaTexto = manejar(() => Promise.reject("texto"))
  const respuesta = await lanzaTexto(new Request("http://x", { method: "POST", body: "{}" }))
  assertEquals(respuesta.status, 500)
  assertEquals(await respuesta.json(), { error: "texto" })
})

Deno.test("manejar entrega el cuerpo JSON al procesador y serializa el resultado con CORS", async () => {
  const eco = manejar((cuerpo) => Promise.resolve({ recibido: cuerpo }))
  const respuesta = await eco(new Request("http://x", { method: "POST", body: JSON.stringify({ a: 1 }) }))
  assertEquals(respuesta.status, 200)
  assertEquals(respuesta.headers.get("Access-Control-Allow-Origin"), "*")
  assertEquals(await respuesta.json(), { recibido: { a: 1 } })
})
