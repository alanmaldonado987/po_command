import { ErrorClickUp } from "./clickup_api.ts"
import { aplicarCambio } from "./clickup_cambios.ts"
import { clienteClickUp, guardarConfigClickUp, listarDestinos, obtenerConfigClickUp } from "./clickup_config.ts"
import type { ResultadoCambio } from "./clickup_tipos.ts"
import { ErrorSolicitud } from "./respuesta.ts"
import { admin, consultar } from "./supabase.ts"

const MAX_VERIFICACIONES = 30

export interface ResumenReconciliacion {
  creadas: number
  actualizadas: number
  archivadas: number
}

const sumar = (total: ResumenReconciliacion, { resultado }: ResultadoCambio): void => {
  if (resultado === "creado") total.creadas += 1
  else if (resultado === "actualizado") total.actualizadas += 1
  else if (resultado === "archivado") total.archivadas += 1
}

async function verificarVinculadasAusentes(
  cliente: Awaited<ReturnType<typeof clienteClickUp>>,
  vistas: Set<string>,
  total: ResumenReconciliacion,
): Promise<void> {
  const vinculadas = await consultar<{ clickup_task_id: string }[]>(
    admin.from("item").select("clickup_task_id").not("clickup_task_id", "is", null).is("eliminado_en", null),
  )
  const ausentes = vinculadas.map((fila) => fila.clickup_task_id).filter((id) => !vistas.has(id))
  for (const tareaId of ausentes.slice(0, MAX_VERIFICACIONES)) {
    try {
      const tarea = await cliente.tarea(tareaId)
      if (tarea.archived) sumar(total, await aplicarCambio(tarea, "reconciliar"))
    } catch (error) {
      if (!(error instanceof ErrorClickUp && error.estado === 404)) throw error
      sumar(total, await aplicarCambio({ id: tareaId }, "taskDeleted"))
    }
  }
}

export async function reconciliar(tableroId: number | null = null): Promise<ResumenReconciliacion> {
  const config = await obtenerConfigClickUp()
  const total: ResumenReconciliacion = { creadas: 0, actualizadas: 0, archivadas: 0 }
  if (!config.habilitado || !config.token) return total
  const cliente = await clienteClickUp(config)
  const destinos = (await listarDestinos()).filter((destino) => tableroId === null || destino.tablero_id === tableroId)
  const listas = [...new Set(destinos.map((destino) => destino.lista_id))]
  const vistas = new Set<string>()
  for (const lista of listas) {
    for (const tarea of await cliente.tareasDeLista(lista)) {
      vistas.add(tarea.id)
      sumar(total, await aplicarCambio(tarea, "reconciliar"))
    }
    for (const tarea of await cliente.tareasDeLista(lista, true)) {
      sumar(total, await aplicarCambio({ ...tarea, archived: true }, "reconciliar"))
    }
  }
  if (tableroId === null) await verificarVinculadasAusentes(cliente, vistas, total)
  await guardarConfigClickUp({ ultimo_sync: new Date().toISOString() })
  return total
}

export async function importarExistentes(
  listaId: string,
  clienteId: number | null,
  tableroId: number | null = null,
): Promise<number> {
  const destino = (await listarDestinos()).find(
    (candidato) => candidato.lista_id === listaId && (tableroId === null || candidato.tablero_id === tableroId),
  )
  const clienteDestino = clienteId ?? destino?.cliente_id ?? null
  if (clienteDestino === null && !destino) {
    throw new ErrorSolicitud("Elige el cliente al que pertenecen las tareas o configura esa lista como destino")
  }
  const cliente = await clienteClickUp()
  let importadas = 0
  for (const tarea of await cliente.tareasDeLista(listaId)) {
    const { resultado } = await aplicarCambio(tarea, "importar", clienteDestino)
    if (resultado === "creado") importadas += 1
  }
  return importadas
}
