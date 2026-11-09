import { formatoFechaHora } from '../../lib/fechas'
import { useAuditoria } from '../../hooks/useConfiguracion'
import { DataTable, ErrorState, LoadingState } from '../../components/ui'

const COLUMNAS = [
  { clave: 'fecha', titulo: 'Fecha', render: (fila) => formatoFechaHora(fila.fecha) },
  { clave: 'entidad', titulo: 'Entidad' },
  { clave: 'entidad_id', titulo: 'ID' },
  { clave: 'accion', titulo: 'Acción' },
  { clave: 'detalle', titulo: 'Detalle', ancho: 280 },
]

export function PestanaAuditoria() {
  const { data = [], isLoading, error } = useAuditoria()
  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />
  return <DataTable columnas={COLUMNAS} filas={data} claveFila={(fila) => fila.id} alturaMaxima={520} vacio="Sin registros de auditoría" />
}
