import { Alert, Button } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { conAviso } from '../../lib/conAviso'
import { useConfiguracion, useGuardarConfiguracion } from '../../hooks/useConfiguracion'

export function AvisoInicio() {
  const { data: configuracion } = useConfiguracion()
  const guardar = useGuardarConfiguracion()
  const notificar = useToast()
  const descartar = conAviso(notificar, () => guardar.mutateAsync({ clave: 'aviso_inicio', valor: '' }))
  const aviso = configuracion?.aviso_inicio
  if (!aviso) return null

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-white p-3 shadow-card">
      <Alert tono="info" className="min-w-0 flex-1">
        {aviso}
      </Alert>
      <Button loading={guardar.isPending} onClick={descartar}>
        Entendido
      </Button>
    </div>
  )
}
