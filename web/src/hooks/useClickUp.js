import { useQuery } from '@tanstack/react-query'
import * as api from '../api/clickup'
import { FILTROS_COLA, LIMITE_ABIERTOS_COLA, ordenarAbiertos } from '../lib/colaClickUp'
import { useMutacion } from './useMutacion'

const MINUTO_MS = 60_000

export const useEstadoClickUp = () => useQuery({ queryKey: ['clickup', 'estado'], queryFn: api.obtenerEstadoClickUp })

export const useJerarquiaClickUp = (equipoId) =>
  useQuery({
    queryKey: ['clickup', 'jerarquia', equipoId],
    queryFn: () => api.obtenerJerarquiaClickUp(equipoId),
    enabled: Boolean(equipoId),
    staleTime: MINUTO_MS,
  })

export const useDestinosClickUp = () => useQuery({ queryKey: ['clickup', 'destinos'], queryFn: api.listarDestinos })

export const useTablerosClickUp = () => useQuery({ queryKey: ['clickup', 'tableros'], queryFn: api.listarTableros })

async function cargarCola(filtro, limite) {
  const { estados } = FILTROS_COLA[filtro]
  if (filtro !== 'todos') {
    const filas = await api.listarColaClickUp({ estados, limite })
    return { filas, hayMas: filas.length >= limite }
  }
  const [abiertos, enviados] = await Promise.all([
    api.listarColaClickUp({ estados: ['Pendiente', 'Fallida'], limite: LIMITE_ABIERTOS_COLA }),
    api.listarColaClickUp({ estados: ['Enviada'], limite }),
  ])
  return { filas: [...ordenarAbiertos(abiertos), ...enviados], hayMas: enviados.length >= limite }
}

export const useColaClickUp = (filtro, limite) =>
  useQuery({ queryKey: ['clickup', 'cola', filtro, limite], queryFn: () => cargarCola(filtro, limite) })

export const usePendientesClickUpDeItem = (itemId) =>
  useQuery({
    queryKey: ['clickup', 'pendientes', itemId],
    queryFn: () => api.listarPendientesDeItem(itemId),
    enabled: Boolean(itemId),
  })

export const useGuardarConfigClickUp = () => useMutacion(api.guardarConfigClickUp, ['clickup'])
export const useProbarClickUp = () => useMutacion(api.probarClickUp, ['clickup'])
export const useCrearTablero = () => useMutacion(api.crearTablero, ['clickup'])
export const useActualizarTablero = () => useMutacion(api.actualizarTablero, ['clickup'])
export const useEliminarTablero = () => useMutacion(api.eliminarTablero, ['clickup', 'personas', 'items'])
export const useGuardarDestino = () => useMutacion(api.guardarDestino, ['clickup'])
export const useEliminarDestino = () => useMutacion(api.eliminarDestino, ['clickup'])
export const useRegistrarWebhook = () => useMutacion(api.registrarWebhookClickUp, ['clickup'])
export const useQuitarWebhook = () => useMutacion(api.quitarWebhookClickUp, ['clickup'])
export const useSincronizarClickUp = () => useMutacion(api.sincronizarClickUp, ['clickup', 'items'])
export const useReconciliarClickUp = () => useMutacion(api.reconciliarClickUp, ['clickup', 'items', 'bloqueantes'])
export const useImportarExistentes = () =>
  useMutacion(api.importarExistentesClickUp, ['clickup', 'items', 'catalogo', 'personas'])
