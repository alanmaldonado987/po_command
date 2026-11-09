import { proveedor, redactarConModelo } from "../_shared/modelo.ts"
import { ErrorSolicitud, manejar } from "../_shared/respuesta.ts"

interface Mensaje {
  role: string
  content: string
}

export const manejador = manejar(async (cuerpo) => {
  if (cuerpo.accion === "estado") {
    const modelo = proveedor()
    return { disponible: modelo !== null, modelo: modelo?.modelo ?? null }
  }
  if (cuerpo.accion === "redactar") {
    const texto = await redactarConModelo(
      String(cuerpo.pregunta ?? ""),
      String(cuerpo.borrador ?? ""),
      (cuerpo.historial as Mensaje[] | undefined) ?? [],
    )
    return { texto }
  }
  throw new ErrorSolicitud(`Acción desconocida: ${cuerpo.accion}`)
})
