import { type ClienteClickUp, ErrorClickUp } from "./clickup_api.ts"
import { aplicarCambio } from "./clickup_cambios.ts"
import {
  asignadoPorCorreo,
  clienteClickUp,
  guardarConfigClickUp,
  listarDestinos,
  listarTableros,
  mapeoEfectivo,
  obtenerConfigClickUp,
  resolverDestino,
} from "./clickup_config.ts"
import {
  construirCuerpoActualizacion,
  construirCuerpoCreacion,
  diferenciaEtiquetas,
  estadoClickUpDe,
  mapeosDeMovimiento,
  msAIso,
  prioridadDeTarea,
} from "./clickup_tarea.ts"
import type {
  ConfigClickUp,
  DestinoClickUp,
  FilaColaClickUp,
  ItemClickUp,
  TableroClickUp,
  TareaClickUp,
} from "./clickup_tipos.ts"
import { admin, consultar } from "./supabase.ts"

const MAX_INTENTOS = 3
const TAMANO_LOTE = 30
const PRESUPUESTO_MS = 100_000
const ESTADOS_SIN_MOVIMIENTO = [403, 404, 405, 501]

class ErrorPermanente extends Error {}

interface Contexto {
  cliente: ClienteClickUp
  config: ConfigClickUp
  tableros: TableroClickUp[]
  destinos: DestinoClickUp[]
}

const esErrorDeEstado = (error: unknown): boolean =>
  error instanceof ErrorClickUp && error.estado === 400 && /status/i.test(error.message)

const esNoEncontrada = (error: unknown): boolean => error instanceof ErrorClickUp && error.estado === 404

const esMovimientoNoDisponible = (error: unknown): boolean =>
  error instanceof ErrorClickUp && ESTADOS_SIN_MOVIMIENTO.includes(error.estado)

async function sinEstadoSiFalla(
  operacion: (cuerpo: Record<string, unknown>) => Promise<TareaClickUp>,
  cuerpo: Record<string, unknown>,
): Promise<TareaClickUp> {
  try {
    return await operacion(cuerpo)
  } catch (error) {
    if (!esErrorDeEstado(error) || !("status" in cuerpo)) throw error
    const { status: _omitido, ...sinEstado } = cuerpo
    return await operacion(sinEstado)
  }
}

const leerItem = (id: number): Promise<ItemClickUp | null> =>
  consultar<ItemClickUp | null>(admin.from("v_item").select("*").eq("id", id).maybeSingle())

const vincular = (itemId: number, tarea: TareaClickUp) =>
  consultar(
    admin
      .from("item")
      .update({
        clickup_task_id: tarea.id,
        clickup_url: tarea.url ?? null,
        clickup_sync_en: msAIso(tarea.date_updated),
        ...(tarea.list?.id ? { clickup_lista_id: tarea.list.id } : {}),
      })
      .eq("id", itemId),
  )

function destinoDelItem(contexto: Contexto, item: ItemClickUp): DestinoClickUp {
  const destino = resolverDestino(contexto.destinos, item.tablero_id ?? null, item.cliente_id)
  if (!destino) {
    throw new ErrorPermanente(
      `Sin destino configurado para ${item.tablero ?? "(sin tablero)"} / ${item.cliente ?? "(sin cliente)"}`,
    )
  }
  return destino
}

async function opcionesDeTarea(contexto: Contexto, item: ItemClickUp) {
  const mapeo = mapeoEfectivo(contexto.config, contexto.tableros, item.tablero_id ?? null)
  return {
    estadoClickUp: estadoClickUpDe(mapeo, item.estado),
    asignadoId: await asignadoPorCorreo(contexto.cliente, contexto.config.equipo_id, item.responsable_correo),
  }
}

async function crearEn(contexto: Contexto, item: ItemClickUp, destino: DestinoClickUp): Promise<TareaClickUp> {
  const cuerpo = construirCuerpoCreacion(item, await opcionesDeTarea(contexto, item))
  const tarea = await sinEstadoSiFalla((parcial) => contexto.cliente.crearTarea(destino.lista_id, parcial), cuerpo)
  await vincular(item.id, tarea)
  return tarea
}

const crear = async (contexto: Contexto, item: ItemClickUp): Promise<void> => {
  await crearEn(contexto, item, destinoDelItem(contexto, item))
}

async function actualizar(contexto: Contexto, item: ItemClickUp): Promise<void> {
  const { cliente } = contexto
  const tareaId = item.clickup_task_id!
  const actual = await cliente.tarea(tareaId)
  if (actual.archived) {
    await aplicarCambio(actual, "reconciliar")
    return
  }
  const asignadosActuales = (actual.assignees ?? []).map((asignado) => asignado.id)
  let tarea = await sinEstadoSiFalla(
    (cuerpo) => cliente.actualizarTarea(tareaId, cuerpo),
    construirCuerpoActualizacion(item, await opcionesDeTarea(contexto, item), asignadosActuales, prioridadDeTarea(actual.priority)),
  )
  const { agregar, quitar } = diferenciaEtiquetas((actual.tags ?? []).map((etiqueta) => etiqueta.name), item)
  for (const etiqueta of agregar) await cliente.agregarEtiqueta(tareaId, etiqueta)
  for (const etiqueta of quitar) await cliente.quitarEtiqueta(tareaId, etiqueta)
  if (agregar.length + quitar.length > 0) tarea = await cliente.tarea(tareaId)
  await vincular(item.id, tarea)
}

async function reemplazar(contexto: Contexto, item: ItemClickUp, anterior: TareaClickUp, destino: DestinoClickUp): Promise<void> {
  const nueva = await crearEn(contexto, item, destino)
  await contexto.cliente.comentarTarea(anterior.id, `Esta tarea se movió a ${nueva.url ?? nueva.id}`).catch(() => undefined)
  await contexto.cliente.actualizarTarea(anterior.id, { archived: true }).catch(() => undefined)
}

async function trasladar(contexto: Contexto, item: ItemClickUp, actual: TareaClickUp, destino: DestinoClickUp): Promise<"movida" | "reemplazada"> {
  const { cliente, config } = contexto
  if (!config.equipo_id) {
    await reemplazar(contexto, item, actual, destino)
    return "reemplazada"
  }
  try {
    const listaDestino = await cliente.lista(destino.lista_id)
    const { estadoClickUp } = await opcionesDeTarea(contexto, item)
    await cliente.moverTarea(config.equipo_id, actual.id, destino.lista_id, mapeosDeMovimiento(actual, listaDestino, estadoClickUp))
    return "movida"
  } catch (error) {
    if (!esMovimientoNoDisponible(error)) throw error
    await reemplazar(contexto, item, actual, destino)
    return "reemplazada"
  }
}

async function mover(contexto: Contexto, item: ItemClickUp): Promise<void> {
  const destino = destinoDelItem(contexto, item)
  const actual = await contexto.cliente.tarea(item.clickup_task_id!)
  if (actual.archived) {
    await aplicarCambio(actual, "reconciliar")
    return
  }
  const resultado = actual.list?.id === destino.lista_id ? "movida" : await trasladar(contexto, item, actual, destino)
  if (resultado === "movida") await actualizar(contexto, item)
}

async function archivar(cliente: ClienteClickUp, itemId: number): Promise<void> {
  const fila = await consultar<{ clickup_task_id: string | null } | null>(
    admin.from("item").select("clickup_task_id").eq("id", itemId).maybeSingle(),
  )
  if (!fila?.clickup_task_id) return
  try {
    await vincular(itemId, await cliente.actualizarTarea(fila.clickup_task_id, { archived: true }))
  } catch (error) {
    if (!esNoEncontrada(error)) throw error
  }
}

async function enviarItem(contexto: Contexto, item: ItemClickUp, accion: "update" | "mover" | "create"): Promise<void> {
  if (!item.clickup_task_id) return crear(contexto, item)
  try {
    await (accion === "mover" ? mover(contexto, item) : actualizar(contexto, item))
  } catch (error) {
    if (!esNoEncontrada(error)) throw error
    await aplicarCambio({ id: item.clickup_task_id }, "taskDeleted")
  }
}

async function procesarFila(contexto: Contexto, fila: FilaColaClickUp): Promise<void> {
  if (fila.accion === "archive") return archivar(contexto.cliente, fila.item_id)
  const item = await leerItem(fila.item_id)
  if (item) await enviarItem(contexto, item, fila.accion)
}

const finalizar = (fila: FilaColaClickUp, cambios: Record<string, unknown>) =>
  consultar(admin.from("clickup_cola").update({ intentos: fila.intentos + 1, reservada_hasta: null, ...cambios }).eq("id", fila.id))

const marcarProcesada = (fila: FilaColaClickUp) =>
  finalizar(fila, { estado: "Procesada", error: null, procesado_en: new Date().toISOString() })

function marcarFallo(fila: FilaColaClickUp, error: unknown) {
  const permanente = error instanceof ErrorPermanente || (error instanceof ErrorClickUp && error.esPermanente)
  const agotada = fila.intentos + 1 >= MAX_INTENTOS
  return finalizar(fila, {
    estado: permanente || agotada ? "Fallida" : "Pendiente",
    error: error instanceof Error ? error.message : String(error),
    procesado_en: new Date().toISOString(),
  })
}

const liberar = (ids: number[]) =>
  ids.length ? consultar(admin.from("clickup_cola").update({ reservada_hasta: null }).in("id", ids)) : Promise.resolve(null)

async function cargarContexto(config: ConfigClickUp): Promise<Contexto> {
  const [cliente, tableros, destinos] = await Promise.all([clienteClickUp(config), listarTableros(), listarDestinos()])
  return { cliente, config, tableros, destinos }
}

export async function sincronizar(ahora: () => number = Date.now): Promise<{ procesadas: number; errores: number }> {
  const config = await obtenerConfigClickUp()
  if (!config.habilitado || !config.token) return { procesadas: 0, errores: 0 }
  const contexto = await cargarContexto(config)
  const filas = await consultar<FilaColaClickUp[]>(admin.rpc("reservar_cola_clickup", { p_limite: TAMANO_LOTE }))
  const inicio = ahora()
  let procesadas = 0
  let errores = 0
  const ordenadas = [...filas].sort((a, b) => a.id - b.id)
  for (const [indice, fila] of ordenadas.entries()) {
    if (ahora() - inicio > PRESUPUESTO_MS) {
      await liberar(ordenadas.slice(indice).map((pendiente) => pendiente.id))
      break
    }
    try {
      await procesarFila(contexto, fila)
      await marcarProcesada(fila)
      procesadas += 1
    } catch (error) {
      await marcarFallo(fila, error)
      errores += 1
    }
  }
  await guardarConfigClickUp({ ultimo_sync: new Date().toISOString() })
  return { procesadas, errores }
}
