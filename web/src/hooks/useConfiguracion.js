import { useQuery } from '@tanstack/react-query'
import * as api from '../api/configuracion'
import { useMutacion } from './useMutacion'

export const useConfiguracion = () => useQuery({ queryKey: ['config'], queryFn: api.obtenerConfiguracion })
export const useGuardarConfiguracion = () =>
  useMutacion(({ clave, valor }) => api.guardarConfiguracion(clave, valor), ['config'])

export const useAuditoria = () => useQuery({ queryKey: ['auditoria'], queryFn: () => api.listarAuditoria() })
export const useImportarPlan = () =>
  useMutacion(({ filas, simular }) => api.importarPlan(filas, simular), ['items', 'catalogo', 'personas', 'notas', 'auditoria'])
