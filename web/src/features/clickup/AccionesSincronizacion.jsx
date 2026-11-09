import { conAviso } from '../../lib/conAviso'
import { useToast } from '../../context/ToastContext'
import {
  useQuitarWebhook,
  useReconciliarClickUp,
  useRegistrarWebhook,
  useSincronizarClickUp,
} from '../../hooks/useClickUp'
import { Button } from '../../components/ui'

export function AccionesSincronizacion({ estado }) {
  const toast = useToast()
  const registrar = useRegistrarWebhook()
  const quitar = useQuitarWebhook()
  const sincronizar = useSincronizarClickUp()
  const reconciliar = useReconciliarClickUp()
  const operativo = estado.conectado && estado.habilitado

  const alternarWebhook = conAviso(toast, async () => {
    if (estado.webhook_registrado) {
      await quitar.mutateAsync()
      toast('Webhook quitado: ClickUp ya no avisa de sus cambios.')
    } else {
      await registrar.mutateAsync()
      toast('Webhook registrado: los cambios de ClickUp llegarán a la app.')
    }
  })

  const ejecutarSincronizacion = conAviso(toast, async () => {
    const { procesadas, errores } = await sincronizar.mutateAsync()
    toast(`${procesadas} cambio(s) procesado(s), ${errores} con error.`, errores ? 'aviso' : 'exito')
  })

  const ejecutarReconciliacion = conAviso(toast, async () => {
    const { creadas, actualizadas, archivadas } = await reconciliar.mutateAsync()
    toast(`Reconciliación: ${creadas} creada(s), ${actualizadas} actualizada(s), ${archivadas} archivada(s).`)
  })

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        icon={estado.webhook_registrado ? 'link_off' : 'webhook'}
        disabled={!estado.conectado}
        loading={registrar.isPending || quitar.isPending}
        onClick={alternarWebhook}
      >
        {estado.webhook_registrado ? 'Quitar webhook' : 'Registrar webhook'}
      </Button>
      <Button variant="primary" icon="sync" disabled={!operativo} loading={sincronizar.isPending} onClick={ejecutarSincronizacion}>
        Sincronizar ahora
      </Button>
      <Button
        icon="rule"
        disabled={!operativo}
        loading={reconciliar.isPending}
        onClick={ejecutarReconciliacion}
        title="Compara los dos lados y corrige las diferencias que haya dejado un webhook perdido."
      >
        Reconciliar
      </Button>
    </div>
  )
}
