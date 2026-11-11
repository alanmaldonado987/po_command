import { useRef, useState } from 'react'
import { conAviso } from '../../lib/conAviso'
import { useToast } from '../../context/ToastContext'
import { useReconciliarClickUp } from '../../hooks/useClickUp'
import { Alert, Button, Modal } from '../../components/ui'

export function ReconciliarForzado({ operativo }) {
  const toast = useToast()
  const reconciliar = useReconciliarClickUp()
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef(null)

  const cerrar = () => {
    setAbierto(false)
    setTimeout(() => contenedor.current?.querySelector('button')?.focus(), 0)
  }

  const confirmar = conAviso(toast, async () => {
    const { creadas, actualizadas, archivadas } = await reconciliar.mutateAsync({ forzar: true })
    cerrar()
    toast(`Reconciliación forzada: ${creadas} creada(s), ${actualizadas} actualizada(s), ${archivadas} archivada(s).`)
  })

  return (
    <div ref={contenedor} className="contents">
      <Button
        icon="rule_settings"
        disabled={!operativo}
        onClick={() => setAbierto(true)}
        title="Actualiza todos los ítems importados con lo que hay hoy en ClickUp."
      >
        Reconciliar a la fuerza
      </Button>
      {abierto && (
        <Modal titulo="Reconciliar a la fuerza" onCerrar={cerrar}>
          <div className="space-y-3">
            <Alert tono="aviso">
              Se actualizarán todos los ítems importados con lo que hay hoy en ClickUp: estado, fechas, responsable y
              prioridad. Se pisarán los cambios que hayas hecho en la app desde que se importaron.
            </Alert>
            <p className="text-sm text-ink-soft">
              Los ítems eliminados y los que tienen un cambio pendiente de enviar a ClickUp no se tocan. Úsalo, por
              ejemplo, después de corregir el mapeo de estados.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="danger" icon="rule_settings" loading={reconciliar.isPending} onClick={confirmar}>
                Sí, reconciliar a la fuerza
              </Button>
              <Button autoFocus onClick={cerrar}>
                Cancelar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
