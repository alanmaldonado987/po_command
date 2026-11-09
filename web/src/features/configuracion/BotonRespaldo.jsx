import { useState } from 'react'
import { useToast } from '../../context/ToastContext'
import { Button } from '../../components/ui'
import { descargarRespaldo } from './respaldo'

export function BotonRespaldo({ etiqueta = 'Descargar respaldo', icono = 'backup', variant = 'secondary', full = false }) {
  const [descargando, setDescargando] = useState(false)
  const toast = useToast()

  const descargar = async () => {
    setDescargando(true)
    try {
      await descargarRespaldo()
    } catch (fallo) {
      toast(`No se pudo generar el respaldo: ${fallo.message}`, 'error')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <Button icon={icono} variant={variant} full={full} loading={descargando} onClick={descargar}>
      {etiqueta}
    </Button>
  )
}
