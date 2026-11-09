import { HorizontalStackedBars } from '../../components/charts/HorizontalStackedBars'
import { Card } from '../../components/ui'
import { COLOR_ESTADO, ESTADO_PRUEBAS } from '../../lib/constantes'
import { avancePorCliente } from '../../lib/dominio'

export const SERIES_ESTADO = [
  { clave: 'terminados', nombre: 'Terminado', color: COLOR_ESTADO.Terminado },
  { clave: 'pruebas', nombre: ESTADO_PRUEBAS, color: COLOR_ESTADO[ESTADO_PRUEBAS] },
  { clave: 'enCurso', nombre: 'En curso', color: COLOR_ESTADO['En curso'] },
  { clave: 'noIniciados', nombre: 'No iniciado', color: COLOR_ESTADO['No iniciado'] },
  { clave: 'suspendidos', nombre: 'Suspendido', color: COLOR_ESTADO.Suspendido },
]

export function AvancePorCliente({ items }) {
  if (items.length === 0) return null
  return (
    <Card title="Avance por cliente" icon="domain" subtitle="Ítems por estado en cada cliente.">
      <HorizontalStackedBars datos={avancePorCliente(items)} claveCategoria="cliente" series={SERIES_ESTADO} />
    </Card>
  )
}
