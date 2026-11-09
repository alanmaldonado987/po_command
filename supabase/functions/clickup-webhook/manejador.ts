import { ErrorClickUp } from "../_shared/clickup_api.ts"
import { aplicarCambio } from "../_shared/clickup_cambios.ts"
import { firmaValida } from "../_shared/clickup_firma.ts"
import { clienteClickUp, obtenerConfigClickUp } from "../_shared/clickup_config.ts"
import { cabecerasCors } from "../_shared/cors.ts"
import { responderJson } from "../_shared/respuesta.ts"

interface EventoClickUp {
  event?: string
  task_id?: string
}

async function procesar({ event, task_id }: EventoClickUp): Promise<unknown> {
  if (!event?.startsWith("task") || !task_id) return "ignorado"
  if (event === "taskDeleted") return await aplicarCambio({ id: task_id }, event)
  try {
    return await aplicarCambio(await (await clienteClickUp()).tarea(task_id), event)
  } catch (error) {
    if (!(error instanceof ErrorClickUp && error.estado === 404)) throw error
    return await aplicarCambio({ id: task_id }, "taskDeleted")
  }
}

export async function manejador(peticion: Request): Promise<Response> {
  if (peticion.method === "OPTIONS") return new Response("ok", { headers: cabecerasCors })
  if (peticion.method !== "POST") return responderJson({ error: "Método no permitido" }, 405)
  const cuerpo = await peticion.text()
  const config = await obtenerConfigClickUp()
  if (!(await firmaValida(cuerpo, peticion.headers.get("X-Signature"), config.webhook_secret))) {
    return responderJson({ error: "Firma inválida" }, 401)
  }
  if (!config.habilitado) return responderJson({ ok: true, resultado: "deshabilitado" })
  try {
    return responderJson({ ok: true, resultado: await procesar(JSON.parse(cuerpo) as EventoClickUp) })
  } catch (error) {
    return responderJson({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
