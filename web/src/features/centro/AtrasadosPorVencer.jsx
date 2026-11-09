import { Card, EmptyState, ListItem, ListaItems } from '../../components/ui'
import { itemsPorVencer } from '../../lib/dominio'
import { formatoFecha } from '../../lib/fechas'
import { tonoEstado } from '../../lib/tonos'

const DIAS_VENTANA = 7
const MAXIMO_VISIBLE = 12

function chipsDeVencimiento({ atraso_dias, estado }) {
  const vencimiento = atraso_dias > 0 ? [`${atraso_dias} día(s) de atraso`, 'rojo'] : ['Por vencer', 'ambar']
  return [vencimiento, [estado, tonoEstado(estado)]]
}

export function AtrasadosPorVencer({ items }) {
  const lista = itemsPorVencer(items, DIAS_VENTANA)

  return (
    <Card
      title="Atrasados y por vencer"
      icon="event_upcoming"
      subtitle="Ítems abiertos con fin planificado vencido o en los próximos 7 días."
    >
      {lista.length === 0 && <EmptyState>Nada vence en los próximos 7 días.</EmptyState>}
      <ListaItems>
        {lista.slice(0, MAXIMO_VISIBLE).map((item) => (
          <ListItem
            key={item.id}
            alerta={item.atraso_dias > 0}
            id={`${item.codigo} · ${item.cliente ?? '-'} · ${item.actividad ?? '-'}`}
            titulo={item.titulo}
            chips={chipsDeVencimiento(item)}
            meta={[
              <>
                Fin planificado <b>{formatoFecha(item.fecha_compromiso)}</b>
              </>,
              <>
                Responsable: <b>{item.responsable ?? 'Sin asignar'}</b>
              </>,
              item.alcance,
            ]}
          />
        ))}
      </ListaItems>
      {lista.length > MAXIMO_VISIBLE && (
        <p className="text-[13px] text-ink-muted">
          Y {lista.length - MAXIMO_VISIBLE} más. Filtra por «Atrasado» en Backlog para verlos todos.
        </p>
      )}
    </Card>
  )
}
