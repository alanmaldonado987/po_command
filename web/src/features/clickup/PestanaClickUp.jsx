import { useEstadoClickUp } from '../../hooks/useClickUp'
import { Alert, ErrorState, LoadingState } from '../../components/ui'
import { AvisoSinDestino } from './AvisoSinDestino'
import { TarjetaActividad } from './TarjetaActividad'
import { TarjetaConexion } from './TarjetaConexion'
import { TarjetaDestinos } from './TarjetaDestinos'
import { TarjetaEstados } from './TarjetaEstados'
import { TarjetaSincronizacion } from './TarjetaSincronizacion'
import { TarjetaTableros } from './TarjetaTableros'

function pasoPendiente(estado) {
  if (!estado.token_configurado) return 'Guarda tu token personal de ClickUp en la tarjeta de conexión y pulsa «Guardar y probar».'
  if (!estado.equipo) return 'Elige el equipo de trabajo en la tarjeta de conexión.'
  if (!estado.habilitado) {
    return 'Configura los destinos y el mapeo de estados, registra el webhook y activa la sincronización.'
  }
  return null
}

export function PestanaClickUp() {
  const { data: estado, isLoading, error } = useEstadoClickUp()

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />

  const paso = pasoPendiente(estado)

  return (
    <div className="space-y-4">
      {paso && (
        <Alert tono="info">
          La sincronización con ClickUp está desactivada. {paso}
        </Alert>
      )}
      <div className="grid grid-cols-2 items-start gap-4 max-lg:grid-cols-1">
        <TarjetaConexion estado={estado} />
        <TarjetaSincronizacion estado={estado} />
      </div>
      <AvisoSinDestino cantidad={estado.sin_destino} />
      <TarjetaTableros />
      <div id="destinos-clickup">
        <TarjetaDestinos equipo={estado.equipo} />
      </div>
      <TarjetaEstados estado={estado} />
      <TarjetaActividad />
    </div>
  )
}
