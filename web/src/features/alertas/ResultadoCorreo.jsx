import { Alert } from '../../components/ui'

export function ResultadoCorreo({ resultado, sufijoExito = '' }) {
  if (!resultado) return null
  if (resultado.ok) {
    return (
      <Alert tono="exito">
        {resultado.detalle}
        {sufijoExito}
      </Alert>
    )
  }
  return (
    <Alert tono="error">
      {resultado.explicacion}
      <br />
      <br />
      Detalle: {resultado.detalle}
    </Alert>
  )
}
