import { Link } from 'react-router-dom'
import { Card, EmptyState, Icon, ListaItems } from '../../components/ui'
import { useProximasAlertas } from '../../hooks/useAlertas'
import { formatoFecha, formatoHora } from '../../lib/fechas'

const LIMITE = 6

function AlertaEnCola({ enviar_en, asunto, destinatarios }) {
  return (
    <article className="grid grid-cols-[72px_1fr] items-start gap-3 rounded-xl border border-line bg-white px-3.5 py-3 max-sm:grid-cols-1 max-sm:gap-1">
      <div className="text-xs leading-snug text-ink-muted">
        <b className="block text-[13px] text-ink">{formatoFecha(enviar_en).slice(0, 5)}</b>
        {formatoHora(new Date(enviar_en))}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-snug text-ink">{asunto}</div>
        <div className="mt-1.5 break-words text-xs text-ink-muted">Para: {destinatarios.join(', ')}</div>
      </div>
    </article>
  )
}

export function ProximasAlertas() {
  const { data: alertas = [] } = useProximasAlertas(LIMITE)

  return (
    <Card title="Próximas alertas" icon="schedule">
      {alertas.length === 0 ? (
        <EmptyState>Nada en cola. El programador revisa las reglas cada 15 minutos.</EmptyState>
      ) : (
        <ListaItems>
          {alertas.map((alerta) => (
            <AlertaEnCola key={alerta.id} {...alerta} />
          ))}
        </ListaItems>
      )}
      <Link to="/alertas" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
        <Icon name="arrow_forward" className="text-[18px]" />
        Gestionar reglas y cola
      </Link>
    </Card>
  )
}
