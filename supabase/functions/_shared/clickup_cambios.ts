import { admin, consultar } from "./supabase.ts"
import type { ResultadoCambio, TareaClickUp } from "./clickup_tipos.ts"

export const aplicarCambio = (
  tarea: Pick<TareaClickUp, "id"> | TareaClickUp,
  evento: string,
  clienteId: number | null = null,
): Promise<ResultadoCambio> =>
  consultar<ResultadoCambio>(admin.rpc("aplicar_cambio_clickup", { p_tarea: tarea, p_evento: evento, p_cliente_id: clienteId }))
