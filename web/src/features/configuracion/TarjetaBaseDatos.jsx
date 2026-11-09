import { useItems } from '../../hooks/useItems'
import { Card } from '../../components/ui'
import { BotonRespaldo } from './BotonRespaldo'

export function TarjetaBaseDatos() {
  const { data: items = [] } = useItems()

  return (
    <Card title="Base de datos" icon="database">
      <p className="text-[13px] text-ink-muted">Supabase · PostgreSQL · {items.length} ítems del backlog</p>
      <BotonRespaldo full />
    </Card>
  )
}
