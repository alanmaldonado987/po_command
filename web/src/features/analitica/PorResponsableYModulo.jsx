import { HorizontalBars } from '../../components/charts/HorizontalBars'
import { Card, EmptyState } from '../../components/ui'
import { PALETA } from '../../lib/constantes'
import { abiertosYAtrasadosPorResponsable, modulosConMasAtrasos } from './metricas'

const SERIES_RESPONSABLE = [
  { clave: 'abiertos', nombre: 'Abiertos', color: '#BAE6FD' },
  { clave: 'atrasados', nombre: 'Atrasados', color: PALETA.rojo },
]
const SERIES_MODULO = [{ clave: 'atrasados', nombre: 'Atrasados', color: PALETA.ambar }]

export function PorResponsable({ items }) {
  return (
    <Card title="Abiertos y atrasados por responsable" icon="groups">
      <HorizontalBars
        datos={abiertosYAtrasadosPorResponsable(items)}
        claveCategoria="responsable"
        series={SERIES_RESPONSABLE}
        solapadas
      />
    </Card>
  )
}

export function ModulosConAtrasos({ items }) {
  const datos = modulosConMasAtrasos(items)
  return (
    <Card title="Módulos con más atrasos" icon="warning">
      {datos.length === 0 ? (
        <EmptyState>Ningún módulo tiene ítems atrasados.</EmptyState>
      ) : (
        <HorizontalBars datos={datos} claveCategoria="modulo" series={SERIES_MODULO} mostrarValores leyenda={false} />
      )}
    </Card>
  )
}
