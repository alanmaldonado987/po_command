import { useState } from 'react'
import { conAviso } from '../../lib/conAviso'
import { ESTADOS_COLA } from '../../lib/constantes'
import { formatoFechaHora } from '../../lib/fechas'
import { useToast } from '../../context/ToastContext'
import { useCancelarAlertas, useCola, useCuerpoAlerta, useReintentarAlertas } from '../../hooks/useAlertas'
import { Button, Card, DataTable, EmptyState, ErrorState, Expander, LoadingState, SegmentedControl } from '../../components/ui'

const COLUMNAS = [
  { clave: 'enviar_en', titulo: 'Enviar en', render: (fila) => formatoFechaHora(fila.enviar_en) },
  { clave: 'regla_codigo', titulo: 'Regla' },
  { clave: 'asunto', titulo: 'Asunto', ancho: 280 },
  { clave: 'destinatarios', titulo: 'Destinatarios', render: (fila) => fila.destinatarios.join(', ') },
  { clave: 'intentos', titulo: 'Intentos' },
  { clave: 'error', titulo: 'Error' },
]

function VistaPreviaCorreo({ alertaId }) {
  const { data, isLoading } = useCuerpoAlerta(alertaId)
  return (
    <Expander titulo="Vista previa del correo" icono="drafts" abierto>
      {isLoading ? (
        <LoadingState />
      ) : (
        <iframe title="Vista previa del correo" sandbox="" srcDoc={data} className="h-[420px] w-full rounded-lg border border-line bg-white" />
      )}
    </Expander>
  )
}

export function ColaEnvios() {
  const notificar = useToast()
  const [estado, setEstado] = useState('Pendiente')
  const [seleccion, setSeleccion] = useState([])
  const cola = useCola(estado)
  const cancelar = useCancelarAlertas()
  const reintentar = useReintentarAlertas()

  const cambiarEstado = (nuevo) => {
    setEstado(nuevo)
    setSeleccion([])
  }

  const cancelarSeleccion = conAviso(notificar, async () => {
    await cancelar.mutateAsync(seleccion)
    setSeleccion([])
  })

  const reintentarSeleccion = conAviso(notificar, async () => {
    const { enviadas = 0, fallidas = 0 } = (await reintentar.mutateAsync(seleccion)) ?? {}
    notificar(`Reintento: ${enviadas} enviada(s), ${fallidas} fallida(s).`, fallidas ? 'aviso' : 'exito')
    setSeleccion([])
  })

  return (
    <Card title="Cola de envíos" icon="outbox">
      <SegmentedControl opciones={ESTADOS_COLA} value={estado} onChange={cambiarEstado} />
      {cola.error && <ErrorState error={cola.error} />}
      {cola.isLoading && <LoadingState />}
      {cola.data?.length === 0 && <EmptyState>Sin registros en este estado.</EmptyState>}
      {cola.data?.length > 0 && (
        <>
          <DataTable
            columnas={COLUMNAS}
            filas={cola.data}
            claveFila={(fila) => fila.id}
            seleccion={seleccion}
            alSeleccionar={setSeleccion}
            multiple
          />
          <div className="flex flex-wrap gap-2">
            {estado === 'Pendiente' && (
              <Button icon="cancel" disabled={!seleccion.length} loading={cancelar.isPending} onClick={cancelarSeleccion}>
                Cancelar seleccionadas
              </Button>
            )}
            {['Fallida', 'Cancelada'].includes(estado) && (
              <Button icon="refresh" disabled={!seleccion.length} loading={reintentar.isPending} onClick={reintentarSeleccion}>
                Reintentar
              </Button>
            )}
          </div>
          {seleccion.length === 1 ? (
            <VistaPreviaCorreo alertaId={seleccion[0]} />
          ) : (
            <p className="text-xs text-ink-muted">Selecciona una fila para ver la vista previa del correo.</p>
          )}
        </>
      )}
    </Card>
  )
}
