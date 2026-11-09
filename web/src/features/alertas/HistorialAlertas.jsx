import { formatoFechaHora } from '../../lib/fechas'
import { tonoEstado } from '../../lib/tonos'
import { useLogNotificaciones } from '../../hooks/useAlertas'
import { Card, Chip, DataTable, ErrorState, LoadingState } from '../../components/ui'

const LIMITE = 300

const COLUMNAS = [
  { clave: 'fecha', titulo: 'Fecha', render: (fila) => formatoFechaHora(fila.fecha) },
  { clave: 'regla_codigo', titulo: 'Regla' },
  { clave: 'asunto', titulo: 'Asunto', ancho: 260 },
  { clave: 'destinatarios', titulo: 'Destinatarios' },
  { clave: 'estado', titulo: 'Estado', render: (fila) => <Chip tono={tonoEstado(fila.estado)}>{fila.estado}</Chip> },
  { clave: 'detalle', titulo: 'Detalle', ancho: 240 },
]

export function HistorialAlertas() {
  const { data, error, isLoading } = useLogNotificaciones(LIMITE)
  return (
    <Card title="Historial" icon="history">
      {error && <ErrorState error={error} />}
      {isLoading && <LoadingState />}
      {data && (
        <DataTable columnas={COLUMNAS} filas={data} claveFila={(fila) => fila.id} alturaMaxima={320} vacio="Sin notificaciones todavía." />
      )}
    </Card>
  )
}
