import type {
  CarpetaClickUp,
  EquipoClickUp,
  EspacioClickUp,
  ListaClickUp,
  MapeoEstadoMovimiento,
  TareaClickUp,
  UsuarioClickUp,
} from "./clickup_tipos.ts"

const BASE = "https://api.clickup.com/api/v2"
const BASE_V3 = "https://api.clickup.com/api/v3"
const MAX_REINTENTOS_LIMITE = 3
const ESPERA_POR_DEFECTO_MS = 5_000
const ESPERA_MAXIMA_MS = 60_000
const MAX_PAGINAS = 100

export const EVENTOS_WEBHOOK = [
  "taskCreated",
  "taskUpdated",
  "taskDeleted",
  "taskStatusUpdated",
  "taskPriorityUpdated",
  "taskAssigneeUpdated",
  "taskDueDateUpdated",
  "taskTagUpdated",
  "taskMoved",
]

export class ErrorClickUp extends Error {
  constructor(mensaje: string, readonly estado: number, readonly codigo?: string) {
    super(mensaje)
  }

  get esPermanente(): boolean {
    return this.estado >= 400 && this.estado < 500 && this.estado !== 408 && this.estado !== 429
  }
}

export interface DependenciasClickUp {
  fetch?: typeof fetch
  esperar?: (ms: number) => Promise<void>
  ahora?: () => number
}

type Cuerpo = Record<string, unknown>

const dormir = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms))

export class ClienteClickUp {
  private llamar: typeof fetch
  private esperar: (ms: number) => Promise<void>
  private ahora: () => number

  constructor(private token: string, dependencias: DependenciasClickUp = {}) {
    this.llamar = dependencias.fetch ?? fetch
    this.esperar = dependencias.esperar ?? dormir
    this.ahora = dependencias.ahora ?? Date.now
  }

  private esperaPorLimite(respuesta: Response): number {
    const reinicio = Number(respuesta.headers.get("X-RateLimit-Reset"))
    if (!reinicio) return ESPERA_POR_DEFECTO_MS
    return Math.min(Math.max(reinicio * 1000 - this.ahora(), 0), ESPERA_MAXIMA_MS)
  }

  private async pedir<T>(metodo: string, ruta: string, cuerpo?: Cuerpo, base = BASE): Promise<T> {
    for (let intento = 0; ; intento += 1) {
      const respuesta = await this.llamar(`${base}${ruta}`, {
        method: metodo,
        headers: { Authorization: this.token, "Content-Type": "application/json" },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      })
      if (respuesta.status === 429 && intento < MAX_REINTENTOS_LIMITE) {
        await this.esperar(this.esperaPorLimite(respuesta))
        continue
      }
      const texto = await respuesta.text()
      const datos = texto ? (JSON.parse(texto) as Record<string, unknown>) : {}
      if (!respuesta.ok) {
        throw new ErrorClickUp(
          String(datos.err ?? datos.message ?? `ClickUp respondió ${respuesta.status}`),
          respuesta.status,
          (datos.ECODE ?? datos.code) as string | undefined,
        )
      }
      return datos as T
    }
  }

  async usuario(): Promise<UsuarioClickUp> {
    return (await this.pedir<{ user: UsuarioClickUp }>("GET", "/user")).user
  }

  async equipos(): Promise<EquipoClickUp[]> {
    return (await this.pedir<{ teams: EquipoClickUp[] }>("GET", "/team")).teams
  }

  async espacios(equipoId: string): Promise<EspacioClickUp[]> {
    return (await this.pedir<{ spaces: EspacioClickUp[] }>("GET", `/team/${equipoId}/space?archived=false`)).spaces
  }

  async carpetas(espacioId: string): Promise<CarpetaClickUp[]> {
    return (await this.pedir<{ folders: CarpetaClickUp[] }>("GET", `/space/${espacioId}/folder?archived=false`)).folders
  }

  async listasSinCarpeta(espacioId: string): Promise<ListaClickUp[]> {
    return (await this.pedir<{ lists: ListaClickUp[] }>("GET", `/space/${espacioId}/list?archived=false`)).lists
  }

  lista(listaId: string): Promise<ListaClickUp> {
    return this.pedir<ListaClickUp>("GET", `/list/${listaId}`)
  }

  async tareasDeLista(listaId: string, archivadas = false): Promise<TareaClickUp[]> {
    const tareas: TareaClickUp[] = []
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
      const consulta = `page=${pagina}&archived=${archivadas}&include_closed=true&include_markdown_description=true`
      const respuesta = await this.pedir<{ tasks: TareaClickUp[]; last_page?: boolean }>(
        "GET",
        `/list/${listaId}/task?${consulta}`,
      )
      tareas.push(...respuesta.tasks)
      if (respuesta.last_page || respuesta.tasks.length === 0) break
    }
    return tareas
  }

  tarea(tareaId: string): Promise<TareaClickUp> {
    return this.pedir<TareaClickUp>("GET", `/task/${tareaId}?include_markdown_description=true`)
  }

  crearTarea(listaId: string, cuerpo: Cuerpo): Promise<TareaClickUp> {
    return this.pedir<TareaClickUp>("POST", `/list/${listaId}/task`, cuerpo)
  }

  actualizarTarea(tareaId: string, cuerpo: Cuerpo): Promise<TareaClickUp> {
    return this.pedir<TareaClickUp>("PUT", `/task/${tareaId}`, cuerpo)
  }

  async moverTarea(equipoId: string, tareaId: string, listaId: string, estados: MapeoEstadoMovimiento[]): Promise<void> {
    const cuerpo = { move_custom_fields: false, ...(estados.length ? { status_mappings: estados } : {}) }
    await this.pedir("PUT", `/workspaces/${equipoId}/tasks/${tareaId}/home_list/${listaId}`, cuerpo, BASE_V3)
  }

  async comentarTarea(tareaId: string, texto: string): Promise<void> {
    await this.pedir("POST", `/task/${tareaId}/comment`, { comment_text: texto, notify_all: false })
  }

  async agregarEtiqueta(tareaId: string, etiqueta: string): Promise<void> {
    await this.pedir("POST", `/task/${tareaId}/tag/${encodeURIComponent(etiqueta)}`)
  }

  async quitarEtiqueta(tareaId: string, etiqueta: string): Promise<void> {
    await this.pedir("DELETE", `/task/${tareaId}/tag/${encodeURIComponent(etiqueta)}`)
  }

  async crearWebhook(equipoId: string, endpoint: string): Promise<{ id: string; secret: string }> {
    const respuesta = await this.pedir<{ id: string; webhook: { id: string; secret: string } }>(
      "POST",
      `/team/${equipoId}/webhook`,
      { endpoint, events: EVENTOS_WEBHOOK },
    )
    return { id: respuesta.webhook?.id ?? respuesta.id, secret: respuesta.webhook.secret }
  }

  async eliminarWebhook(webhookId: string): Promise<void> {
    await this.pedir("DELETE", `/webhook/${webhookId}`)
  }
}
