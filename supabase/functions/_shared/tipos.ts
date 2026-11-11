export type Fila = [string, string]

export interface Destinatario {
  nombre: string
  correo: string
  rol: string
}

export interface Persona {
  id: number
  nombre: string
  correo: string
  tipo: "equipo" | "stakeholder"
  rol: string
  recibe: string[]
  activo: boolean
  cliente_ids: number[]
}

export interface Item {
  id: number
  codigo: string
  titulo: string
  funcionalidad: string
  estado: string
  bloqueado: boolean
  motivo_bloqueo: string
  cliente_id: number | null
  cliente: string | null
  actividad: string | null
  modulo: string | null
  fase: string
  alcance: string
  responsable_id: number | null
  responsable: string | null
  fecha_compromiso: string | null
  plan_pruebas_fin: string | null
  atraso_dias: number
  terminado_en: string | null
}

export interface BloqueanteAbierto {
  id: number
  item_id: number
  codigo: string
  cliente: string | null
  motivo: string
  abierto_en: string
  escalado_en: string | null
}

export interface Ceremonia {
  id: number
  tipo: string
  titulo: string
  fecha_hora: string
  duracion_min: number
  lugar: string
  audiencia: string
  notas: string
  cliente: string | null
}

export interface Acuerdo {
  id: number
  descripcion: string
  origen: string
  fecha_limite: string | null
  estado: string
  responsable_id: number | null
}

export interface Regla {
  codigo: string
  categoria: string
  destinatarios: string[]
  parametro: number | string
  hora_envio: string
  activa: boolean
}

export interface AlertaProgramada {
  id: number
  regla_codigo: string
  asunto: string
  cuerpo_html: string
  destinatarios: string[]
  enviar_en: string
  intentos: number
}

export interface CambioFecha {
  campo: string
  antes: string | null
  despues: string | null
}

export interface ResultadoGuardado {
  id: number
  antes: { bloqueado: boolean; motivo_bloqueo: string } | null
  cambios: CambioFecha[]
  sin_cambios: boolean
  bloqueado?: boolean
}
