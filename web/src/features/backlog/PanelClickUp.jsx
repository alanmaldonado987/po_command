import { useDestinosClickUp, useEstadoClickUp, usePendientesClickUpDeItem } from '../../hooks/useClickUp'
import { Alert, Card, Chip, Icon } from '../../components/ui'
import { resolverDestino } from '../clickup/destinos'
import { ChipPrioridad } from './ChipPrioridad'

const ACCIONES = { create: 'creación', update: 'actualización', archive: 'archivado', mover: 'cambio de tablero' }

function EnlaceClickUp({ url }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[10px] border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-line-soft"
    >
      <Icon name="open_in_new" className="text-[18px]" />
      Abrir en ClickUp
    </a>
  )
}

export function PanelClickUp({ item }) {
  const vinculado = Boolean(item.clickup_task_id)
  const { data: estado } = useEstadoClickUp()
  const { data: destinos = [] } = useDestinosClickUp()
  const { data: pendientes = [] } = usePendientesClickUpDeItem(vinculado ? item.id : null)

  const sinDestino =
    Boolean(estado?.habilitado) &&
    Boolean(item.responsable_id) &&
    !resolverDestino(destinos, item.tablero_id, item.cliente_id).destino

  if (!vinculado && !sinDestino) return null

  return (
    <Card title="ClickUp" icon="hub">
      {item.tablero && (
        <div className="flex items-center gap-2 text-sm text-ink-soft">
          Tablero <Chip tono="violeta">{item.tablero}</Chip>
        </div>
      )}
      {item.prioridad && (
        <div className="flex items-center gap-2 text-sm text-ink-soft">
          Prioridad <ChipPrioridad prioridad={item.prioridad} />
        </div>
      )}
      {vinculado && item.clickup_url && <EnlaceClickUp url={item.clickup_url} />}
      {sinDestino && (
        <Alert tono="aviso">
          Sin destino en ClickUp para {item.tablero ?? 'Sin tablero'} / {item.cliente ?? 'Sin cliente'}: el ítem no se
          enviará hasta que configures uno en Configuración & Datos → ClickUp.
        </Alert>
      )}
      {pendientes.length > 0 && (
        <Alert tono="info">
          Sincronización pendiente: {pendientes.map((fila) => ACCIONES[fila.accion] ?? fila.accion).join(', ')}.
        </Alert>
      )}
    </Card>
  )
}
