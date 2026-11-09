import { hoyIso } from '../../lib/fechas'
import { descargarLibro } from '../../lib/excel/descargar'
import { exportarPlan } from '../../lib/excel/exportarPlan'
import { useItems, useTodasLasNotas } from '../../hooks/useItems'
import { Button } from '../../components/ui'
import { BotonRespaldo } from './BotonRespaldo'

export function PestanaExportar() {
  const { data: items = [] } = useItems()
  const { data: notas = [] } = useTodasLasNotas()

  const descargarPlan = () =>
    descargarLibro(exportarPlan(items, notas), `Plan_de_Trabajo_${hoyIso().replaceAll('-', '')}.xlsx`)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Button variant="primary" icon="table_view" disabled={!items.length} onClick={descargarPlan}>
          Descargar backlog en formato Plan de Trabajo
        </Button>
        <p className="text-xs text-ink-muted">
          Una hoja por cliente con las mismas columnas de tu archivo; las consideraciones salen de la bitácora.
        </p>
      </div>
      <BotonRespaldo etiqueta="Exportar todas las tablas (técnico)" icono="database" />
    </div>
  )
}
