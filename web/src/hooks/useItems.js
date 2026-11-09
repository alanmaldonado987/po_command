import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/items'
import { sincronizarClickUp } from '../api/clickup'
import { useMutacion } from './useMutacion'

const DEPENDIENTES = ['items', 'bloqueantes', 'notas', 'catalogo', 'personas', 'alertas', 'auditoria', 'clickup']

export const useItems = () => useQuery({ queryKey: ['items'], queryFn: api.listarItems })

export const useBloqueantesAbiertos = () =>
  useQuery({ queryKey: ['bloqueantes', 'abiertos'], queryFn: api.listarBloqueantesAbiertos })

export const useBloqueantes = () => useQuery({ queryKey: ['bloqueantes', 'todos'], queryFn: api.listarBloqueantes })

export const useNotas = (itemId) =>
  useQuery({ queryKey: ['notas', itemId], queryFn: () => api.listarNotas(itemId), enabled: Boolean(itemId) })

export const useTodasLasNotas = () => useQuery({ queryKey: ['notas', 'todas'], queryFn: api.listarTodasLasNotas })

function useConEnvioInmediato(funcion) {
  const cliente = useQueryClient()
  return useCallback(
    async (...argumentos) => {
      const resultado = await funcion(...argumentos)
      sincronizarClickUp()
        .then(() => Promise.all(['items', 'clickup'].map((clave) => cliente.invalidateQueries({ queryKey: [clave] }))))
        .catch(() => {})
      return resultado
    },
    [funcion, cliente],
  )
}

export const useGuardarItem = () => useMutacion(useConEnvioInmediato(api.guardarItem), DEPENDIENTES)
export const useEliminarItem = () => useMutacion(useConEnvioInmediato(api.eliminarItem), DEPENDIENTES)
export const useEliminarNota = () => useMutacion(api.eliminarNota, ['notas'])
