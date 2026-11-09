import { DonutChart } from '../../components/charts/DonutChart'
import { Card, EmptyState } from '../../components/ui'
import { COLOR_ESTADO, ESTADOS } from '../../lib/constantes'
import { estadoVisible } from '../../lib/dominio'

const ORDEN = [...ESTADOS, 'Bloqueado']

function datosDona(items) {
  const conteo = {}
  items.forEach((item) => {
    const estado = estadoVisible(item)
    conteo[estado] = (conteo[estado] ?? 0) + 1
  })
  return ORDEN.filter((estado) => conteo[estado]).map((estado) => ({
    nombre: estado,
    valor: conteo[estado],
    color: COLOR_ESTADO[estado],
  }))
}

export function EstadoItemsDonut({ items }) {
  return (
    <Card title="Estado de los ítems" icon="donut_large">
      {items.length ? (
        <DonutChart datos={datosDona(items)} total={items.length} etiquetaTotal="ítems" />
      ) : (
        <EmptyState>El backlog está vacío.</EmptyState>
      )}
    </Card>
  )
}
