import { ESTADO_PRUEBAS, TONO_CEREMONIA } from '../../lib/constantes'
import { conAviso } from '../../lib/conAviso'
import { formatoFechaHora } from '../../lib/fechas'
import { tonoEstado } from '../../lib/tonos'
import { useToast } from '../../context/ToastContext'
import { useDestinatarios, useInvitarCeremonia } from '../../hooks/useAlertas'
import { useEliminarCeremonia } from '../../hooks/useCeremonias'
import { Button, Card, Chip, ListItem, ListaItems } from '../../components/ui'

const MAXIMO_ITEMS = 20

function ItemsParaDemo({ items, cliente }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-ink">
        Ítems de {cliente} listos para mostrar (terminados, en etapa de pruebas)
      </p>
      {items.length === 0 && <p className="text-sm text-ink-muted">Ninguno todavía.</p>}
      <ListaItems>
        {items.slice(0, MAXIMO_ITEMS).map((item) => (
          <ListItem
            key={item.id}
            id={`${item.codigo} · ${item.actividad ?? '-'}`}
            titulo={item.titulo}
            meta={[item.responsable ?? '-', item.alcance]}
            chips={[[item.estado, tonoEstado(item.estado)]]}
          />
        ))}
      </ListaItems>
      {items.length > MAXIMO_ITEMS && <p className="text-xs text-ink-muted">Y {items.length - MAXIMO_ITEMS} más.</p>}
    </div>
  )
}

export function DetalleCeremonia({ ceremonia, items, alEliminar }) {
  const notificar = useToast()
  const invitar = useInvitarCeremonia()
  const eliminar = useEliminarCeremonia()
  const destinatarios = useDestinatarios({
    roles: ['audiencia', 'po'],
    categoria: 'Ceremonias',
    audiencia: ceremonia.audiencia,
  })
  const nombres = (destinatarios.data ?? []).map((d) => d.nombre)

  const enviarInvitacion = conAviso(notificar, async () => {
    const { destinatarios: total } = await invitar.mutateAsync(ceremonia.id)
    notificar(`Invitación enviada a ${total} persona(s).`)
  })

  const borrar = conAviso(notificar, async () => {
    await eliminar.mutateAsync(ceremonia.id)
    notificar('Ceremonia eliminada y sus recordatorios cancelados.')
    alEliminar()
  })

  const paraDemo =
    ceremonia.tipo === 'Demo' && ceremonia.cliente_id
      ? items.filter((i) => i.cliente_id === ceremonia.cliente_id && i.estado === ESTADO_PRUEBAS)
      : null

  return (
    <Card title={ceremonia.titulo} icon="event_available">
      <div className="flex flex-wrap gap-1.5">
        <Chip tono={TONO_CEREMONIA[ceremonia.tipo] ?? 'gris'}>{ceremonia.tipo}</Chip>
        <Chip>{formatoFechaHora(ceremonia.fecha_hora)}</Chip>
        <Chip>{ceremonia.lugar}</Chip>
      </div>
      <p className="text-sm">
        <b className="text-ink">Recibirán la invitación ({nombres.length}):</b>{' '}
        {nombres.join(', ') || 'nadie con correo válido'}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          icon="send"
          variant={ceremonia.invitacion_enviada ? 'secondary' : 'primary'}
          loading={invitar.isPending}
          onClick={enviarInvitacion}
        >
          {ceremonia.invitacion_enviada ? 'Reenviar invitación' : 'Enviar invitación'}
        </Button>
        <Button icon="delete" loading={eliminar.isPending} onClick={borrar}>
          Eliminar ceremonia
        </Button>
      </div>
      {paraDemo && <ItemsParaDemo items={paraDemo} cliente={ceremonia.cliente} />}
    </Card>
  )
}
