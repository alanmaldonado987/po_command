import { despachar } from "./cola.ts"
import type { ResultadoCambio, TareaClickUp } from "./clickup_tipos.ts"
import { alGuardarItem } from "./eventos.ts"
import type { ResultadoGuardado } from "./tipos.ts"

export const MAX_ITEMS_CON_ALERTAS = 15
const ORIGEN = "ClickUp"

export interface LimiteAlertas {
  restante: number
  omitidas: number
  avisados: number
}

export const crearLimiteAlertas = (maximo = MAX_ITEMS_CON_ALERTAS): LimiteAlertas => ({ restante: maximo, omitidas: 0, avisados: 0 })

const mereceAviso = ({ antes, cambios, bloqueado }: ResultadoGuardado): boolean =>
  cambios.length > 0 || bloqueado === undefined || (antes?.bloqueado ?? false) !== bloqueado

const claveDelCambio = (itemId: number, tarea: Pick<TareaClickUp, "date_updated">): string | undefined =>
  tarea.date_updated ? `CK:${itemId}:${tarea.date_updated}` : undefined

function consumir(limite: LimiteAlertas | undefined): boolean {
  if (!limite) return true
  if (limite.restante <= 0) {
    limite.omitidas += 1
    console.warn("Alertas de ClickUp omitidas: se alcanzó el tope por ejecución")
    return false
  }
  limite.restante -= 1
  return true
}

/**
 * Encola los correos inmediatos (bloqueo, desbloqueo y reprogramación) de un ítem que ClickUp acaba de
 * modificar. Solo actúa sobre cambios «actualizado»: ni la creación ni la importación avisan. Nunca lanza.
 */
export async function alertarCambioDeClickUp(
  cambio: ResultadoCambio,
  tarea: Pick<TareaClickUp, "date_updated">,
  limite?: LimiteAlertas,
): Promise<boolean> {
  const { guardado } = cambio
  if (cambio.resultado !== "actualizado" || !guardado || !mereceAviso(guardado)) return false
  if (!consumir(limite)) return false
  try {
    await alGuardarItem(guardado, { origen: ORIGEN, clave: claveDelCambio(guardado.id, tarea) })
    if (limite) limite.avisados += 1
    return true
  } catch (error) {
    console.error("No se pudieron encolar las alertas del cambio de ClickUp", error)
    return false
  }
}

interface TiempoDeEjecucion {
  waitUntil(trabajo: Promise<unknown>): void
}

/** Envía la cola de alertas sin dejar que un fallo de correo afecte a la sincronización. */
export async function despacharSinFallar(): Promise<void> {
  const trabajo = despachar().then(
    () => undefined,
    (error) => console.error("No se pudo despachar la cola de alertas", error),
  )
  const tiempo = (globalThis as { EdgeRuntime?: TiempoDeEjecucion }).EdgeRuntime
  if (tiempo?.waitUntil) tiempo.waitUntil(trabajo)
  else await trabajo
}
