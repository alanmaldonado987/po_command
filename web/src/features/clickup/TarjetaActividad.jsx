import { formatoFechaHora } from '../../lib/fechas'
import { tonoEstado } from '../../lib/tonos'
import { useColaClickUp } from '../../hooks/useClickUp'
import { useItems } from '../../hooks/useItems'
import { Card, EmptyState, ErrorState, ListItem, ListaItems, LoadingState } from '../../components/ui'

const ACCIONES = { create: 'Crear', update: 'Actualizar', archive: 'Archivar', mover: 'Mover' }
const LIMITE = 15

export function TarjetaActividad() {
  const { data: cola = [], isLoading, error } = useColaClickUp(LIMITE)
  const { data: items = [] } = useItems()
  const codigoDe = (itemId) => items.find((item) => item.id === itemId)?.codigo ?? `Ítem ${itemId}`

  return (
    <Card title="Actividad" icon="history" subtitle="Los últimos envíos de la app hacia ClickUp.">
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {!isLoading && !error && cola.length === 0 && <EmptyState>Aún no se ha enviado nada a ClickUp.</EmptyState>}
      <ListaItems>
        {cola.map((fila) => (
          <ListItem
            key={fila.id}
            id={`${codigoDe(fila.item_id)} · ${ACCIONES[fila.accion] ?? fila.accion}`}
            cuerpo={fila.error ?? undefined}
            chips={[[fila.estado, tonoEstado(fila.estado)]]}
            alerta={fila.estado === 'Fallida'}
            meta={[formatoFechaHora(fila.procesado_en ?? fila.creado_en), `Intentos: ${fila.intentos}`]}
          />
        ))}
      </ListaItems>
    </Card>
  )
}
