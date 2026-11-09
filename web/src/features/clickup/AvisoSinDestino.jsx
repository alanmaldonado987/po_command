import { Alert } from '../../components/ui'

export function AvisoSinDestino({ cantidad = 0 }) {
  if (!cantidad) return null

  return (
    <Alert tono="aviso">
      {cantidad} ítem(s) abiertos no tienen destino en ClickUp y no se enviarán. Configura el destino de su tablero y
      cliente, o un destino por defecto.{' '}
      <a href="#destinos-clickup" className="font-semibold underline">
        Corregir destinos
      </a>
    </Alert>
  )
}
