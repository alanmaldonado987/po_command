import { assertEquals } from "jsr:@std/assert@1"
import { ErrorClickUp } from "../_shared/clickup_api.ts"
import { sincronizar } from "../_shared/clickup_cola.ts"
import { mapeoEfectivo, resolverDestino } from "../_shared/clickup_config.ts"
import { importarExistentes, reconciliar } from "../_shared/clickup_reconciliar.ts"
import { mapeosDeMovimiento } from "../_shared/clickup_tarea.ts"
import type { ConfigClickUp, DestinoClickUp, ListaClickUp, TableroClickUp } from "../_shared/clickup_tipos.ts"
import { ErrorSolicitud } from "../_shared/respuesta.ts"
import { manejador } from "../clickup/manejador.ts"
import type { Fila } from "./base_falsa.ts"
import { configClickUp, destino, entornoClickUp, filaCola, itemVinculable, tablero, tareaClickUp } from "./clickup_falso.ts"

const DESARROLLO = 1
const ANALITICA = 2
const AIR_E = 1
const ACUACAR = 2

const dest = (id: number, tableroId: number | null, clienteId: number | null, lista: string): DestinoClickUp => ({
  id,
  tablero_id: tableroId,
  cliente_id: clienteId,
  lista_id: lista,
  lista_nombre: lista,
})

const DESTINOS = [
  dest(1, null, null, "L-DEFECTO"),
  dest(2, null, AIR_E, "L-CLIENTE"),
  dest(3, ANALITICA, null, "L-ANALITICA"),
  dest(4, ANALITICA, AIR_E, "L-ANALITICA-AIRE"),
]

Deno.test("resolverDestino sigue el mismo orden de prioridad que destino_clickup en SQL", () => {
  const casos: [number | null, number | null, string | null][] = [
    [ANALITICA, AIR_E, "L-ANALITICA-AIRE"],
    [ANALITICA, ACUACAR, "L-ANALITICA"],
    [DESARROLLO, AIR_E, "L-CLIENTE"],
    [null, AIR_E, "L-CLIENTE"],
    [DESARROLLO, ACUACAR, "L-DEFECTO"],
    [null, null, "L-DEFECTO"],
  ]
  for (const [tableroId, clienteId, esperado] of casos) {
    assertEquals(resolverDestino(DESTINOS, tableroId, clienteId)?.lista_id, esperado, `tablero ${tableroId} cliente ${clienteId}`)
  }
})

Deno.test("resolverDestino: el tablero específico gana al cliente específico sin tablero", () => {
  const sinExacto = DESTINOS.filter((d) => d.id !== 4)
  assertEquals(resolverDestino(sinExacto, ANALITICA, AIR_E)?.lista_id, "L-ANALITICA")
})

Deno.test("resolverDestino devuelve null sin coincidencias y no depende del orden de la lista", () => {
  assertEquals(resolverDestino([], ANALITICA, AIR_E), null)
  assertEquals(resolverDestino([...DESTINOS].reverse(), ANALITICA, AIR_E)?.lista_id, "L-ANALITICA-AIRE")
  assertEquals(resolverDestino([dest(9, DESARROLLO, null, "L-DEV")], ANALITICA, null), null)
})

const config = configClickUp() as unknown as ConfigClickUp
const tableroAnalitica = (mapeo: Record<string, string> | null): TableroClickUp => ({ id: ANALITICA, nombre: "Analítica", mapeo_estados: mapeo })

Deno.test("mapeoEfectivo: el tablero reemplaza solo los estados que define y el resto cae al global", () => {
  const mapeo = mapeoEfectivo(config, [tableroAnalitica({ "En curso": "analizando" })], ANALITICA)
  assertEquals(mapeo["En curso"], "analizando")
  assertEquals(mapeo.Terminado, "entregado")
})

Deno.test("mapeoEfectivo: sin tablero, con tablero desconocido o sin mapeo propio usa el global", () => {
  assertEquals(mapeoEfectivo(config, [tableroAnalitica(null)], ANALITICA), config.mapeo_estados)
  assertEquals(mapeoEfectivo(config, [tableroAnalitica({ "En curso": "x" })], null), config.mapeo_estados)
  assertEquals(mapeoEfectivo(config, [], 99), config.mapeo_estados)
})

const lista = (estados: ListaClickUp["statuses"]): ListaClickUp => ({ id: "L-AN", name: "Analítica", statuses: estados })

Deno.test("mapeosDeMovimiento: si el estado actual existe en la lista destino no hace falta mapear", () => {
  const actual = tareaClickUp({ status: { id: "s1", status: "En Desarrollo" } })
  assertEquals(mapeosDeMovimiento(actual, lista([{ id: "a1", status: "en desarrollo" }]), "analizando"), [])
})

Deno.test("mapeosDeMovimiento: compara los estados sin emojis, tildes ni mayúsculas", () => {
  const actual = tareaClickUp({ status: { id: "s1", status: "En Desarrollo", type: "custom" } })
  assertEquals(mapeosDeMovimiento(actual, lista([{ id: "a1", status: "🧑‍💻 EN DESARROLLO" }]), "analizando"), [])
  const destinoLista = lista([{ id: "a1", status: "pendiente", type: "open" }, { id: "a2", status: "☑ ENTREGADO", type: "closed" }])
  assertEquals(mapeosDeMovimiento(actual, destinoLista, "Entregado"), [{ source_status: "s1", destination_status: "a2" }])
})

Deno.test("mapeosDeMovimiento: elige el estado objetivo del tablero cuando el actual no existe", () => {
  const actual = tareaClickUp({ status: { id: "s1", status: "en desarrollo" } })
  const destinoLista = lista([{ id: "a1", status: "pendiente", type: "open" }, { id: "a2", status: "analizando", type: "custom" }])
  assertEquals(mapeosDeMovimiento(actual, destinoLista, "Analizando"), [{ source_status: "s1", destination_status: "a2" }])
})

Deno.test("mapeosDeMovimiento: sin objetivo conocido usa el primer estado abierto y luego el primero de la lista", () => {
  const actual = tareaClickUp({ status: { id: "s1", status: "en desarrollo" } })
  const conAbierto = lista([{ id: "a1", status: "cerrada", type: "closed" }, { id: "a2", status: "nueva", type: "open" }])
  assertEquals(mapeosDeMovimiento(actual, conAbierto, undefined)[0].destination_status, "a2")
  assertEquals(mapeosDeMovimiento(actual, lista([{ id: "a1", status: "otra" }]), "inexistente")[0].destination_status, "a1")
})

Deno.test("mapeosDeMovimiento: sin identificador de estado o sin estados en destino devuelve vacío", () => {
  assertEquals(mapeosDeMovimiento(tareaClickUp({ status: { status: "x" } }), lista([{ id: "a1", status: "y" }]), "y"), [])
  assertEquals(mapeosDeMovimiento(tareaClickUp({ status: { id: "s1", status: "x" } }), lista([]), "y"), [])
  assertEquals(mapeosDeMovimiento(tareaClickUp({ status: { id: "s1", status: "x" } }), lista([{ status: "y" }]), "y"), [])
})

const MIEMBROS = [{ user: { id: 2, username: "lk", email: "lk@ises.com.co" } }]

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

type Entorno = ReturnType<typeof preparar>
const fila = (entorno: Entorno, tabla: string) => entorno.base.filas(tabla)[0]

const TABLEROS_BD = [tablero({ id: DESARROLLO, nombre: "Desarrollo" }), tablero({ id: ANALITICA, nombre: "Analítica", mapeo_estados: { "En curso": "analizando" } })]
const DESTINOS_BD = [
  destino({ id: 1, tablero_id: null, cliente_id: null, lista_id: "L-DEF" }),
  destino({ id: 2, tablero_id: DESARROLLO, cliente_id: null, lista_id: "L-DEV" }),
  destino({ id: 3, tablero_id: ANALITICA, cliente_id: null, lista_id: "L-AN" }),
]

Deno.test("create: usa la lista y el mapeo de estados del tablero del responsable", async () => {
  const entorno = preparar({
    item: { tablero_id: ANALITICA, tablero: "Analítica", responsable_correo: "lk@ises.com.co" },
    datos: { clickup_tablero: TABLEROS_BD, clickup_destino: DESTINOS_BD },
  })
  assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
  const [listaId, cuerpo] = entorno.cliente.llamadasDe("crearTarea")[0] as [string, Record<string, unknown>]
  assertEquals(listaId, "L-AN")
  assertEquals(cuerpo.status, "analizando")
  assertEquals(fila(entorno, "item").clickup_lista_id, "L-AN")
})

Deno.test("create: un ítem sin tablero va al destino por defecto con el mapeo global", async () => {
  const entorno = preparar({ datos: { clickup_tablero: TABLEROS_BD, clickup_destino: DESTINOS_BD } })
  await sincronizar()
  const [listaId, cuerpo] = entorno.cliente.llamadasDe("crearTarea")[0] as [string, Record<string, unknown>]
  assertEquals([listaId, cuerpo.status], ["L-DEF", "en desarrollo"])
})

Deno.test("create: un destino con valores nulos de tablero antiguos se interpreta como sin tablero", async () => {
  const antiguo: Fila = { id: 1, cliente_id: 1, lista_id: "L-VIEJA", lista_nombre: "AIR-E" }
  const entorno = preparar({ datos: { clickup_destino: [antiguo] } })
  await sincronizar()
  assertEquals(entorno.cliente.llamadasDe("crearTarea")[0][0], "L-VIEJA")
})

Deno.test("create: sin destino nombra el tablero y el cliente y falla de forma permanente", async () => {
  const entorno = preparar({
    item: { tablero_id: ANALITICA, tablero: "Analítica" },
    datos: { clickup_destino: [destino({ id: 2, tablero_id: DESARROLLO, cliente_id: null, lista_id: "L-DEV" })] },
  })
  assertEquals(await sincronizar(), { procesadas: 0, errores: 1 })
  const cola = fila(entorno, "clickup_cola")
  assertEquals([cola.estado, cola.error], ["Fallida", "Sin destino configurado para Analítica / AIR-E"])
})

const MOVER = {
  item: { clickup_task_id: "T-9", tablero_id: ANALITICA, tablero: "Analítica", estado: "En curso" },
  cola: [filaCola({ accion: "mover" })],
  datos: { clickup_tablero: TABLEROS_BD, clickup_destino: DESTINOS_BD },
}

function prepararMovimiento(opciones: { tarea?: Partial<ReturnType<typeof tareaClickUp>>; item?: Fila; cola?: Fila[]; config?: Fila } = {}) {
  const entorno = preparar({
    ...MOVER,
    item: { ...MOVER.item, ...opciones.item },
    cola: opciones.cola ?? MOVER.cola,
    datos: { ...MOVER.datos, ...(opciones.config ? { clickup_config: [configClickUp(opciones.config)] } : {}) },
  })
  entorno.cliente.tareas.set(
    "T-9",
    tareaClickUp({ id: "T-9", list: { id: "L-DEV" }, status: { id: "st-1", status: "en desarrollo" }, ...opciones.tarea }),
  )
  entorno.cliente.detalleListas["L-AN"] = {
    id: "L-AN",
    name: "Analítica",
    statuses: [{ id: "a1", status: "analizando", type: "open" }, { id: "a2", status: "entregado", type: "closed" }],
  }
  return entorno
}

Deno.test("mover: usa el movimiento nativo a la lista destino con el estado mapeado y luego actualiza la tarea", async () => {
  const entorno = prepararMovimiento()
  assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
  assertEquals(entorno.cliente.llamadasDe("moverTarea"), [["EQ-1", "T-9", "L-AN", [{ source_status: "st-1", destination_status: "a1" }]]])
  const [id, cuerpo] = entorno.cliente.llamadasDe("actualizarTarea")[0] as [string, Record<string, unknown>]
  assertEquals([id, cuerpo.status], ["T-9", "analizando"])
  const item = fila(entorno, "item")
  assertEquals([item.clickup_task_id, item.clickup_lista_id], ["T-9", "L-AN"])
  assertEquals(entorno.cliente.llamadasDe("crearTarea").length, 0)
  assertEquals(fila(entorno, "clickup_cola").estado, "Procesada")
})

Deno.test("mover: sin mapeo de estados cuando el estado actual existe en la lista destino", async () => {
  const entorno = prepararMovimiento({ tarea: { status: { id: "st-1", status: "Analizando" } } })
  await sincronizar()
  assertEquals((entorno.cliente.llamadasDe("moverTarea")[0] as unknown[])[3], [])
})

Deno.test("mover: si la tarea ya está en la lista destino solo se actualiza", async () => {
  const entorno = prepararMovimiento({ tarea: { list: { id: "L-AN" } } })
  assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
  assertEquals(entorno.cliente.llamadasDe("moverTarea").length, 0)
  assertEquals(entorno.cliente.llamadasDe("actualizarTarea").length, 1)
})

Deno.test("mover: si el movimiento nativo no está disponible crea la tarea en el destino y archiva la anterior con un aviso", async () => {
  for (const estado of [403, 404, 405, 501]) {
    const entorno = prepararMovimiento()
    entorno.cliente.fallar("moverTarea", new ErrorClickUp("no disponible", estado))
    assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
    const [listaId] = entorno.cliente.llamadasDe("crearTarea")[0] as [string]
    assertEquals(listaId, "L-AN")
    const item = fila(entorno, "item")
    assertEquals([item.clickup_task_id, item.clickup_lista_id], ["T-1", "L-AN"])
    const [anterior, aviso] = entorno.cliente.llamadasDe("comentarTarea")[0] as [string, string]
    assertEquals(anterior, "T-9")
    assertEquals(aviso.includes("T-1"), true)
    assertEquals(entorno.cliente.llamadasDe("actualizarTarea"), [["T-9", { archived: true }]])
  }
})

Deno.test("mover: si fallan el comentario o el archivado la tarea nueva ya quedó vinculada y la fila se procesa", async () => {
  const entorno = prepararMovimiento()
  entorno.cliente.fallar("moverTarea", new ErrorClickUp("no disponible", 405))
  entorno.cliente.fallar("comentarTarea", new Error("sin permiso"))
  entorno.cliente.fallar("actualizarTarea", new Error("sin permiso"))
  assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
  assertEquals(fila(entorno, "item").clickup_task_id, "T-1")
})

Deno.test("mover: sin equipo configurado reemplaza la tarea en lugar de intentar el movimiento", async () => {
  const entorno = prepararMovimiento({ config: { equipo_id: null } })
  assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
  assertEquals(entorno.cliente.llamadasDe("moverTarea").length, 0)
  assertEquals(fila(entorno, "item").clickup_task_id, "T-1")
})

Deno.test("mover: un error distinto reintenta la fila sin reemplazar la tarea y a los 3 intentos queda fallida", async () => {
  const entorno = prepararMovimiento()
  entorno.cliente.fallar("moverTarea", new ErrorClickUp("caído", 500))
  assertEquals(await sincronizar(), { procesadas: 0, errores: 1 })
  assertEquals([fila(entorno, "clickup_cola").estado, fila(entorno, "clickup_cola").intentos], ["Pendiente", 1])
  assertEquals(entorno.cliente.llamadasDe("crearTarea").length, 0)
  assertEquals(fila(entorno, "item").clickup_task_id, "T-9")

  const agotada = prepararMovimiento({ cola: [filaCola({ accion: "mover", intentos: 2 })] })
  agotada.cliente.fallar("moverTarea", new ErrorClickUp("caído", 500))
  await sincronizar()
  assertEquals(fila(agotada, "clickup_cola").estado, "Fallida")
})

Deno.test("mover: sin destino para el ítem la fila falla de forma permanente", async () => {
  const entorno = prepararMovimiento({ item: { tablero_id: 99, tablero: "Otro" } })
  entorno.base.tablas.clickup_destino = [destino({ id: 2, tablero_id: DESARROLLO, cliente_id: null, lista_id: "L-DEV" })]
  assertEquals(await sincronizar(), { procesadas: 0, errores: 1 })
  assertEquals(fila(entorno, "clickup_cola").error, "Sin destino configurado para Otro / AIR-E")
  assertEquals(entorno.cliente.llamadasDe("moverTarea").length, 0)
})

Deno.test("mover: una tarea archivada en ClickUp se reconcilia en la app y no se mueve", async () => {
  const entorno = prepararMovimiento({ tarea: { archived: true } })
  assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
  assertEquals(entorno.cliente.llamadasDe("moverTarea").length, 0)
  assertEquals(entorno.base.rpcs.find((r) => r.nombre === "aplicar_cambio_clickup")?.argumentos, {
    p_tarea: entorno.cliente.tareas.get("T-9"),
    p_evento: "reconciliar",
    p_cliente_id: null,
  })
})

Deno.test("mover: si la tarea ya no existe en ClickUp se aplica la eliminación en la app", async () => {
  const entorno = prepararMovimiento()
  entorno.cliente.tareas.delete("T-9")
  assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
  const rpc = entorno.base.rpcs.find((r) => r.nombre === "aplicar_cambio_clickup")
  assertEquals(rpc?.argumentos, { p_tarea: { id: "T-9" }, p_evento: "taskDeleted", p_cliente_id: null })
})

Deno.test("mover: una fila de un ítem eliminado se procesa sin llamar a ClickUp", async () => {
  const entorno = preparar({ ...MOVER, datos: { ...MOVER.datos, v_item: [] } })
  assertEquals(await sincronizar(), { procesadas: 1, errores: 0 })
  assertEquals(entorno.cliente.llamadasDe("tarea").length, 0)
})

Deno.test("una fila update no mueve la tarea aunque esté en otra lista", async () => {
  const entorno = prepararMovimiento({ cola: [filaCola({ accion: "update" })] })
  await sincronizar()
  assertEquals(entorno.cliente.llamadasDe("moverTarea").length, 0)
  assertEquals(entorno.cliente.llamadasDe("actualizarTarea").length, 1)
})

async function llamar(cuerpo: unknown): Promise<{ estado: number; datos: Record<string, unknown> }> {
  const respuesta = await manejador(new Request("http://localhost/", { method: "POST", body: JSON.stringify(cuerpo) }))
  return { estado: respuesta.status, datos: await respuesta.json() }
}

Deno.test("estado incluye los tableros con su cantidad de destinos y los ítems sin destino", async () => {
  const entorno = entornoClickUp({
    clickup_tablero: TABLEROS_BD,
    clickup_destino: [...DESTINOS_BD, destino({ id: 4, tablero_id: ANALITICA, cliente_id: AIR_E, lista_id: "L-AN-AIRE" })],
  })
  entorno.base.manejadoresRpc.contar_items_sin_destino_clickup = () => 3
  entorno.cliente.equiposActuales = []
  const { estado, datos } = await llamar({ accion: "estado" })
  assertEquals(estado, 200)
  assertEquals(datos.tableros, [
    { id: DESARROLLO, nombre: "Desarrollo", mapeo_estados: null, destinos: 1 },
    { id: ANALITICA, nombre: "Analítica", mapeo_estados: { "En curso": "analizando" }, destinos: 2 },
  ])
  assertEquals(datos.sin_destino, 3)
})

Deno.test("estado no cuenta como destinos del tablero los destinos por defecto", async () => {
  const entorno = entornoClickUp({ clickup_tablero: TABLEROS_BD, clickup_destino: [destino({ id: 1, tablero_id: null })] })
  entorno.cliente.equiposActuales = []
  const { datos } = await llamar({ accion: "estado" })
  assertEquals((datos.tableros as { destinos: number }[]).map((t) => t.destinos), [0, 0])
})

Deno.test("reconciliar con tablero_id solo recorre las listas de ese tablero y no verifica tareas ausentes", async () => {
  const entorno = entornoClickUp({
    item: [itemVinculable({ clickup_task_id: "T-AUSENTE" })],
    clickup_destino: [
      destino({ id: 1, tablero_id: DESARROLLO, cliente_id: null, lista_id: "L-DEV" }),
      destino({ id: 2, tablero_id: ANALITICA, cliente_id: null, lista_id: "L-AN" }),
      destino({ id: 3, tablero_id: null, cliente_id: null, lista_id: "L-DEF" }),
    ],
  })
  entorno.base.manejadoresRpc.aplicar_cambio_clickup = () => ({ resultado: "sin_cambios" })
  entorno.cliente.tareasPorLista = { "L-AN": [tareaClickUp({ id: "A" })] }
  await reconciliar(ANALITICA)
  assertEquals(entorno.cliente.llamadasDe("tareasDeLista").filter((l) => l[1] === false).map((l) => l[0]), ["L-AN"])
  assertEquals(entorno.cliente.llamadasDe("tarea").length, 0)
})

Deno.test("reconciliar sin tablero_id recorre todas las listas destino", async () => {
  const entorno = entornoClickUp({
    clickup_destino: [
      destino({ id: 1, tablero_id: DESARROLLO, cliente_id: null, lista_id: "L-DEV" }),
      destino({ id: 2, tablero_id: ANALITICA, cliente_id: null, lista_id: "L-AN" }),
    ],
  })
  entorno.base.manejadoresRpc.aplicar_cambio_clickup = () => ({ resultado: "sin_cambios" })
  await reconciliar()
  assertEquals(entorno.cliente.llamadasDe("tareasDeLista").filter((l) => l[1] === false).map((l) => l[0]), ["L-DEV", "L-AN"])
})

Deno.test("importarExistentes infiere el cliente del destino de la lista y respeta el tablero indicado", async () => {
  const entorno = entornoClickUp({
    clickup_destino: [
      destino({ id: 1, tablero_id: DESARROLLO, cliente_id: AIR_E, lista_id: "L-COMUN" }),
      destino({ id: 2, tablero_id: ANALITICA, cliente_id: ACUACAR, lista_id: "L-COMUN" }),
    ],
  })
  entorno.base.manejadoresRpc.aplicar_cambio_clickup = () => ({ resultado: "creado" })
  entorno.cliente.tareasPorLista = { "L-COMUN": [tareaClickUp({ id: "A" }), tareaClickUp({ id: "B" })] }
  assertEquals(await importarExistentes("L-COMUN", null, ANALITICA), 2)
  const clientes = entorno.base.rpcs.map((r) => (r.argumentos as { p_cliente_id: number | null }).p_cliente_id)
  assertEquals(clientes, [ACUACAR, ACUACAR])
})

Deno.test("importarExistentes pide el cliente si la lista no es un destino de ese tablero", async () => {
  entornoClickUp({ clickup_destino: [destino({ id: 1, tablero_id: DESARROLLO, cliente_id: null, lista_id: "L-DEV" })] })
  const error = await importarExistentes("L-DEV", null, ANALITICA).catch((e) => e)
  assertEquals(error instanceof ErrorSolicitud, true)
})

Deno.test("las acciones validan tablero_id", async () => {
  entornoClickUp()
  assertEquals((await llamar({ accion: "reconciliar", tablero_id: "uno" })).estado, 400)
  assertEquals((await llamar({ accion: "importar_existentes", lista_id: "L-1", tablero_id: "uno" })).estado, 400)
})
