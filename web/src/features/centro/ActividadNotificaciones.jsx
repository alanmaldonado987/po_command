import { Card, EmptyState, ListItem, ListaItems } from '../../components/ui'
import { useLogNotificaciones } from '../../hooks/useAlertas'
import { formatoFechaHora } from '../../lib/fechas'
import { tonoEstado } from '../../lib/tonos'

const LIMITE = 8

export function ActividadNotificaciones() {
  const { data: registros = [] } = useLogNotificaciones(LIMITE)

  return (
    <Card title="Actividad de notificaciones" icon="history">
      {registros.length === 0 && <EmptyState>Aún no se ha enviado ninguna notificación.</EmptyState>}
      <ListaItems>
        {registros.map(({ id, fecha, regla_codigo, asunto, destinatarios, estado }) => (
          <ListItem
            key={id}
            id={`${formatoFechaHora(fecha)} · ${regla_codigo ?? ''}`}
            titulo={asunto ?? ''}
            meta={[`Para: ${destinatarios || '-'}`]}
            chips={[[estado, tonoEstado(estado)]]}
          />
        ))}
      </ListaItems>
    </Card>
  )
}
