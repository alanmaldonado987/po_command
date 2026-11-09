import { useQuery } from '@tanstack/react-query'
import * as api from '../api/correo'
import { useMutacion } from './useMutacion'

export const useConfigCorreo = () => useQuery({ queryKey: ['correo'], queryFn: api.obtenerConfigCorreo })

export const useGuardarConfigCorreo = () => useMutacion(api.guardarConfigCorreo, ['correo'])
export const useProbarConexion = () => useMutacion(api.probarConexionCorreo)
export const useEnviarCorreoPrueba = () => useMutacion(api.enviarCorreoPrueba)
export const useCambiarModoEnvio = () => useMutacion(api.cambiarModoEnvio, ['correo', 'auditoria'])
