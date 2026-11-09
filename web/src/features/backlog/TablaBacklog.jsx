import { estaAbierto, estadoVisible } from '../../lib/dominio'
import { formatoFecha, hoyIso } from '../../lib/fechas'
import { tonoEstado } from '../../lib/tonos'
import { exportarPlan } from '../../lib/excel/exportarPlan'
import { descargarLibro } from '../../lib/excel/descargar'
import { useTodasLasNotas } from '../../hooks/useItems'
import { Button, Card, Chip, DataTable, EmptyState, Icon } from '../../components/ui'
import { ChipPrioridad } from './ChipPrioridad'

const COLUMNAS = [
  { clave: 'codigo', titulo: 'Código', fijo: true, ancho: 90 },
  { clave: 'producto', titulo: 'Producto' },
  { clave: 'cliente', titulo: 'Cliente' },
  { clave: 'actividad', titulo: 'Actividad' },
  { clave: 'modulo', titulo: 'Módulo' },
  { clave: 'funcionalidad', titulo: 'Funcionalidad', ancho: 200 },
  { clave: 'fase', titulo: 'Fase' },
  { clave: 'alcance', titulo: 'Alcance' },
  { clave: 'responsable', titulo: 'Responsable' },
  { clave: 'fecha_compromiso', titulo: 'Fin planificado', render: (i) => formatoFecha(i.fecha_compromiso) },
  { clave: 'fecha_entrega', titulo: 'Fin ejecutado', render: (i) => formatoFecha(i.fecha_entrega) },
  {
    clave: 'estado',
    titulo: 'Estado',
    render: (i) => <Chip tono={tonoEstado(estadoVisible(i))}>{estadoVisible(i)}</Chip>,
  },
  { clave: 'prioridad', titulo: 'Prioridad', render: (i) => <ChipPrioridad prioridad={i.prioridad} /> },
  { clave: 'atraso_dias', titulo: 'Atraso (días)', render: (i) => i.atraso_dias || '' },
  {
    clave: 'clickup',
    titulo: 'ClickUp',
    render: (i) => (
      <span className="inline-flex items-center gap-1.5">
        {i.clickup_task_id && (
          <span title="Vinculado a ClickUp" aria-label="Vinculado a ClickUp">
            <Icon name="link" className="text-brand" />
          </span>
        )}
        {i.tablero && <Chip tono="violeta">{i.tablero}</Chip>}
      </span>
    ),
  },
]

export function TablaBacklog({ items, seleccionado, alSeleccionar }) {
  const { data: notas = [] } = useTodasLasNotas()
  const abiertos = items.filter(estaAbierto).length
  const atrasados = items.filter((item) => item.atrasado).length

  const descargar = () => descargarLibro(exportarPlan(items, notas), `Plan_de_Trabajo_${hoyIso().replaceAll('-', '')}.xlsx`)

  return (
    <Card
      title={`${items.length} ítems · ${abiertos} abiertos · ${atrasados} atrasados`}
      icon="list_alt"
      actions={
        <Button icon="download" disabled={!items.length} onClick={descargar} title="Excel con una hoja por cliente y las mismas columnas de tu archivo.">
          Descargar en formato Plan de Trabajo
        </Button>
      }
    >
      {items.length === 0 ? (
        <EmptyState>No hay ítems que coincidan con el filtro.</EmptyState>
      ) : (
        <>
          <DataTable
            columnas={COLUMNAS}
            filas={items}
            claveFila={(item) => item.id}
            seleccion={seleccionado ? [seleccionado] : []}
            alSeleccionar={(claves) => alSeleccionar(claves[0] ?? null)}
          />
          <p className="text-xs text-ink-muted">
            Toca una fila para editarla. «Completo» en Funcionalidad significa todo el módulo.
          </p>
        </>
      )}
    </Card>
  )
}
