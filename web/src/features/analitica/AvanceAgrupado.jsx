import { HorizontalStackedBars } from '../../components/charts/HorizontalStackedBars'
import { Card } from '../../components/ui'
import { COLOR_ESTADO } from '../../lib/constantes'
import { ORDEN_ESTADOS, conteoPorEstado } from './metricas'

const SERIES = ORDEN_ESTADOS.map((estado) => ({ clave: estado, nombre: estado, color: COLOR_ESTADO[estado] }))

export function AvanceAgrupado({ titulo, icono, items, campo, sinValor }) {
  return (
    <Card title={titulo} icon={icono}>
      <HorizontalStackedBars datos={conteoPorEstado(items, campo, sinValor)} claveCategoria="categoria" series={SERIES} />
    </Card>
  )
}
