import { useQuery } from '@tanstack/react-query'
import * as api from '../api/personas'
import { useMutacion } from './useMutacion'

const DEPENDIENTES = ['personas', 'items', 'auditoria']

export const usePersonas = () => useQuery({ queryKey: ['personas'], queryFn: api.listarPersonas })

export const useGuardarPersona = () => useMutacion(api.guardarPersona, DEPENDIENTES)
export const useEliminarPersona = () => useMutacion(api.eliminarPersona, DEPENDIENTES)
