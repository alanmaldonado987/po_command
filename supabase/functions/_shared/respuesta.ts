import { autorizar } from "./autorizacion.ts"
import { cabecerasCors } from "./cors.ts"

export class ErrorSolicitud extends Error {}

export function exigir(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) throw new ErrorSolicitud(mensaje)
}

export function responderJson(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cabecerasCors, "Content-Type": "application/json" },
  })
}

export function manejar(procesar: (cuerpo: Record<string, unknown>) => Promise<unknown>) {
  return async (peticion: Request): Promise<Response> => {
    if (peticion.method === "OPTIONS") return new Response("ok", { headers: cabecerasCors })
    if (!(await autorizar(peticion))) return responderJson({ error: "No autorizado" }, 401)
    try {
      const cuerpo = (await peticion.json().catch(() => ({}))) as Record<string, unknown>
      return responderJson(await procesar(cuerpo))
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error)
      return responderJson({ error: mensaje }, error instanceof ErrorSolicitud ? 400 : 500)
    }
  }
}
