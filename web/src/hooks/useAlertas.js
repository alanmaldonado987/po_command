import { useQuery } from '@tanstack/react-query'
import * as api from '../api/alertas'
import { useMutacion } from './useMutacion'

const COLA = ['alertas', 'items', 'bloqueantes', 'ceremonias']

export const useReglas = () => useQuery({ queryKey: ['alertas', 'reglas'], queryFn: api.listarReglas })
export const useCola = (estado) => useQuery({ queryKey: ['alertas', 'cola', estado], queryFn: () => api.listarCola(estado) })
export const useProximasAlertas = (limite) =>
  useQuery({ queryKey: ['alertas', 'proximas', limite], queryFn: () => api.listarProximasAlertas(limite) })
export const useConteoAlertas = () => useQuery({ queryKey: ['alertas', 'conteo'], queryFn: api.contarAlertas })
export const useLogNotificaciones = (limite) =>
  useQuery({ queryKey: ['alertas', 'log', limite], queryFn: () => api.listarLog(limite) })
export const useAlertasPorRegla = () => useQuery({ queryKey: ['alertas', 'por-regla'], queryFn: api.listarAlertasPorRegla })
export const useCuerpoAlerta = (id) =>
  useQuery({ queryKey: ['alertas', 'cuerpo', id], queryFn: () => api.obtenerCuerpoAlerta(id), enabled: Boolean(id) })

export const useDestinatarios = (consulta, habilitado = true) =>
  useQuery({
    queryKey: ['alertas', 'destinatarios', consulta],
    queryFn: () => api.resolverDestinatarios(consulta),
    enabled: habilitado,
  })

export const useActualizarRegla = () => useMutacion(({ id, cambios }) => api.actualizarRegla(id, cambios), ['alertas'])
export const useCancelarAlertas = () => useMutacion(api.cancelarAlertas, ['alertas'])
export const useReintentarAlertas = () =>
  useMutacion(async (ids) => {
    await api.reintentarAlertas(ids)
    return api.despacharCola()
  }, ['alertas'])

export const useRevisarReglas = () => useMutacion(api.revisarReglasAhora, COLA)
export const useNotificarItemGuardado = () => useMutacion(api.notificarItemGuardado, COLA)
export const useEscalarBloqueo = () => useMutacion(api.escalarBloqueo, COLA)
export const useEnviarResumen = () => useMutacion(api.enviarResumenSemanal, COLA)
export const useRecordarVencimientos = () => useMutacion(api.recordarVencimientos, COLA)
export const useInvitarCeremonia = () => useMutacion(api.invitarCeremonia, COLA)
