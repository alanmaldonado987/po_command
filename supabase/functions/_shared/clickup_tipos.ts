import type { ResultadoGuardado } from "./tipos.ts"

export type EstadoApp = "No iniciado" | "En curso" | "Terminado, en etapa de pruebas" | "Terminado" | "Suspendido"

export const ESTADOS_APP: EstadoApp[] = [
  "No iniciado",
  "En curso",
  "Terminado, en etapa de pruebas",
  "Terminado",
  "Suspendido",
]

export type MapeoEstados = Record<string, string | string[]>

export interface ConfigClickUp {
  habilitado: boolean
  token: string
  equipo_id: string | null
  equipo_nombre: string
  webhook_id: string | null
  webhook_secret: string
  mapeo_estados: MapeoEstados
  ultimo_sync: string | null
}

export interface TableroClickUp {
  id: number
  nombre: string
  mapeo_estados: MapeoEstados | null
}

export interface DestinoClickUp {
  id: number
  tablero_id: number | null
  cliente_id: number | null
  lista_id: string
  lista_nombre: string
}

export type AccionCola = "create" | "update" | "archive" | "mover"

export interface FilaColaClickUp {
  id: number
  item_id: number
  accion: AccionCola
  estado: "Pendiente" | "Procesada" | "Fallida"
  intentos: number
  error: string | null
}

export interface ItemClickUp {
  id: number
  codigo: string
  titulo: string
  funcionalidad: string
  descripcion: string
  estado: string
  bloqueado: boolean
  motivo_bloqueo: string
  prioridad?: string | null
  producto: string | null
  cliente_id: number | null
  cliente: string | null
  actividad: string | null
  modulo: string | null
  fase: string
  alcance: string
  responsable_id: number | null
  responsable_correo: string | null
  plan_ini: string | null
  plan_fin: string | null
  plan_pruebas_ini: string | null
  plan_pruebas_fin: string | null
  real_ini: string | null
  real_fin: string | null
  real_pruebas_ini: string | null
  real_pruebas_fin: string | null
  fecha_compromiso: string | null
  tablero_id: number | null
  tablero: string | null
  clickup_task_id: string | null
  clickup_url: string | null
  clickup_lista_id: string | null
}

export interface UsuarioClickUp {
  id: number
  username: string
  email: string
}

export interface PrioridadClickUp {
  id?: string | number
  priority?: string
}

export interface TareaClickUp {
  id: string
  name: string
  text_content?: string
  description?: string
  markdown_description?: string
  status?: { id?: string; status: string; type?: string }
  date_updated: string
  archived?: boolean
  assignees?: UsuarioClickUp[]
  tags?: { name: string }[]
  priority?: PrioridadClickUp | null
  due_date: string | null
  start_date: string | null
  url?: string
  list?: { id: string; name?: string }
}

export interface EquipoClickUp {
  id: string
  name: string
  members?: { user: UsuarioClickUp }[]
}

export interface EstadoListaClickUp {
  id?: string
  status: string
  type?: string
}

export interface ListaClickUp {
  id: string
  name: string
  statuses?: EstadoListaClickUp[]
}

export interface MapeoEstadoMovimiento {
  source_status: string
  destination_status: string
}

export interface CarpetaClickUp {
  id: string
  name: string
  lists?: ListaClickUp[]
}

export interface EspacioClickUp {
  id: string
  name: string
}

export interface ResultadoCambio {
  resultado: "creado" | "actualizado" | "sin_cambios" | "archivado" | "ignorado"
  item_id?: number
  codigo?: string
  motivo?: string
  guardado?: ResultadoGuardado
}
