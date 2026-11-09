import { useState } from 'react'
import { useToast } from '../../context/ToastContext'
import { useEliminarItem } from '../../hooks/useItems'
import { Alert, Button, Card } from '../../components/ui'

export function PanelAcciones({ item, alDuplicar, alEliminar }) {
  const [confirmando, setConfirmando] = useState(false)
  const eliminar = useEliminarItem()
  const toast = useToast()

  const confirmarEliminacion = async () => {
    try {
      const canceladas = await eliminar.mutateAsync(item.id)
      toast(`${item.codigo} eliminado; ${canceladas} alerta(s) programada(s) cancelada(s).`)
      alEliminar()
    } catch (fallo) {
      toast(fallo.message, 'error')
    }
  }

  return (
    <Card>
      <Button
        icon="content_copy"
        full
        onClick={alDuplicar}
        title="Abre un ítem nuevo con los mismos datos, por ejemplo para otro alcance (Web / Mobile) u otra actividad."
      >
        Duplicar ítem
      </Button>
      {confirmando ? (
        <>
          <Alert tono="error">
            ¿Eliminar {item.codigo}? Se cancelarán sus alertas programadas. Queda registrado en auditoría.
          </Alert>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="danger" loading={eliminar.isPending} onClick={confirmarEliminacion}>
              Sí, eliminar
            </Button>
            <Button onClick={() => setConfirmando(false)}>Cancelar</Button>
          </div>
        </>
      ) : (
        <Button icon="delete" full onClick={() => setConfirmando(true)}>
          Eliminar ítem
        </Button>
      )}
    </Card>
  )
}
