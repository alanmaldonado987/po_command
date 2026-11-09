import { useQuery } from '@tanstack/react-query'
import * as api from '../api/ia'
import { useMutacion } from './useMutacion'

export const useEstadoIa = () =>
  useQuery({ queryKey: ['ia'], queryFn: api.obtenerEstadoIa, staleTime: Infinity, retry: false })

export const useRedactarConModelo = () => useMutacion(api.redactarConModelo)
