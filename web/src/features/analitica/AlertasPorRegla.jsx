import { HorizontalStackedBars } from '../../components/charts/HorizontalStackedBars'
import { Card, EmptyState } from '../../components/ui'
import { useAlertasPorRegla } from '../../hooks/useAlertas'
import { PALETA } from '../../lib/constantes'
import { alertasPorRegla } from './metricas'

const SERIES = [
  { clave: 'Enviadas', nombre: 'Enviadas', color: PALETA.verde },
  { clave: 'Fallidas', nombre: 'Fallidas', color: PALETA.rojo },
]

export function AlertasPorRegla() {
  const { data: registros = [] } = useAlertasPorRegla()
  const datos = alertasPorRegla(registros)

  return (
    <Card title="Alertas por regla" icon="notifications">
      {datos.length === 0 ? (
        <EmptyState>Aún no se han enviado alertas.</EmptyState>
      ) : (
        <HorizontalStackedBars datos={datos} claveCategoria="regla" series={SERIES} />
      )}
    </Card>
  )
}
