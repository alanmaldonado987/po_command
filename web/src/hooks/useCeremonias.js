import { useQuery } from '@tanstack/react-query'
import * as api from '../api/ceremonias'
import { useMutacion } from './useMutacion'

export const useCeremonias = () => useQuery({ queryKey: ['ceremonias'], queryFn: api.listarCeremonias })
export const useAcuerdos = () => useQuery({ queryKey: ['acuerdos'], queryFn: api.listarAcuerdos })

export const useGuardarCeremonia = () => useMutacion(api.guardarCeremonia, ['ceremonias', 'auditoria'])
export const useEliminarCeremonia = () => useMutacion(api.eliminarCeremonia, ['ceremonias', 'alertas', 'auditoria'])
export const useGuardarAcuerdo = () => useMutacion(api.guardarAcuerdo, ['acuerdos'])
export const useEliminarAcuerdo = () => useMutacion(api.eliminarAcuerdo, ['acuerdos'])
