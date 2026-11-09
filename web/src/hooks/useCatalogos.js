import { useQuery } from '@tanstack/react-query'
import * as api from '../api/catalogos'
import { useMutacion } from './useMutacion'

const DEPENDIENTES = ['catalogo', 'items', 'auditoria']

export const useCatalogo = (tabla) => useQuery({ queryKey: ['catalogo', tabla], queryFn: () => api.listarCatalogo(tabla) })

export const useCrearRegistro = () => useMutacion(({ tabla, datos }) => api.crearRegistro(tabla, datos), DEPENDIENTES)

export const useActualizarRegistro = () =>
  useMutacion(({ tabla, id, datos }) => api.actualizarRegistro(tabla, id, datos), DEPENDIENTES)

export const useEliminarRegistro = () => useMutacion(({ tabla, id }) => api.eliminarRegistro(tabla, id), DEPENDIENTES)
