import type {
  ItemClickUp,
  ListaClickUp,
  MapeoEstadoMovimiento,
  MapeoEstados,
  PrioridadClickUp,
  TareaClickUp,
} from "./clickup_tipos.ts"

const MARCA_INICIO = "<!--po-command"
const MARCA_FIN = "-->"
const MS_HORA = 3_600_000
const DESFASE_BOGOTA_HORAS = 5
const ETIQUETA_BLOQUEADO = "bloqueado"
const ETIQUETAS_GESTIONADAS = [ETIQUETA_BLOQUEADO, "web", "mobile", "data", "automatización", "apk", "desarrollo", "customización"]

const PRIORIDAD_A_CLICKUP: Record<string, number> = { Urgente: 1, Alta: 2, Normal: 3, Baja: 4 }
const PRIORIDAD_POR_NOMBRE: Record<string, number> = { urgent: 1, high: 2, normal: 3, low: 4 }

export const prioridadAClickUp = (item: Pick<ItemClickUp, "prioridad">): number | null =>
  PRIORIDAD_A_CLICKUP[item.prioridad ?? ""] ?? null

export function prioridadDeTarea(prioridad: PrioridadClickUp | null | undefined): number | null {
  if (!prioridad) return null
  const porNombre = PRIORIDAD_POR_NOMBRE[String(prioridad.priority ?? "").toLowerCase()]
  if (porNombre) return porNombre
  const porId = Number(prioridad.id)
  return porId >= 1 && porId <= 4 ? porId : null
}

export const normalizarEtiqueta = (nombre: string): string => nombre.trim().toLowerCase()

export const fechaAMs = (fecha: string): number => new Date(`${fecha}T12:00:00-05:00`).getTime()

export function msAFecha(ms: string | number | null | undefined): string | null {
  if (ms === null || ms === undefined || ms === "") return null
  return new Date(Number(ms) - DESFASE_BOGOTA_HORAS * MS_HORA).toISOString().slice(0, 10)
}

export const msAIso = (ms: string | number): string => new Date(Number(ms)).toISOString()

function escaparJson(valor: unknown): string {
  return JSON.stringify(valor).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
}

export function construirBloque(item: ItemClickUp): string {
  const datos = {
    codigo: item.codigo,
    producto: item.producto,
    cliente: item.cliente,
    actividad: item.actividad,
    modulo: item.modulo,
    fase: item.fase,
    alcance: item.alcance,
    descripcion: item.descripcion,
    plan_ini: item.plan_ini,
    plan_fin: item.plan_fin,
    plan_pruebas_ini: item.plan_pruebas_ini,
    plan_pruebas_fin: item.plan_pruebas_fin,
    real_ini: item.real_ini,
    real_fin: item.real_fin,
    real_pruebas_ini: item.real_pruebas_ini,
    real_pruebas_fin: item.real_pruebas_fin,
    bloqueado: item.bloqueado,
    motivo: item.motivo_bloqueo,
  }
  return `${MARCA_INICIO} ${escaparJson(datos)} ${MARCA_FIN}`
}

export function leerBloque(descripcion: string | null | undefined): Record<string, unknown> | null {
  const texto = descripcion ?? ""
  const inicio = texto.indexOf(MARCA_INICIO)
  const fin = texto.lastIndexOf(MARCA_FIN)
  if (inicio < 0 || fin < inicio) return null
  try {
    return JSON.parse(texto.slice(inicio + MARCA_INICIO.length, fin)) as Record<string, unknown>
  } catch {
    return null
  }
}

const fila = (etiqueta: string, valor: string | null | undefined): string => `**${etiqueta}:** ${valor || "-"}`

export function construirDescripcion(item: ItemClickUp): string {
  const partes = [
    item.descripcion,
    [
      fila("Código", item.codigo),
      fila("Cliente", item.cliente),
      fila("Actividad", item.actividad),
      fila("Módulo", item.modulo),
      fila("Fase", item.fase),
      fila("Alcance", item.alcance),
      fila("Planificado", `${item.plan_ini ?? "-"} → ${item.fecha_compromiso ?? "-"}`),
      fila("Ejecutado", `${item.real_ini ?? "-"} → ${item.real_pruebas_fin ?? item.real_fin ?? "-"}`),
      ...(item.bloqueado ? [fila("Bloqueado", item.motivo_bloqueo)] : []),
    ].join("\n\n"),
    construirBloque(item),
  ]
  return partes.filter(Boolean).join("\n\n")
}

export function etiquetasDeItem(item: ItemClickUp): string[] {
  return [item.alcance, item.fase, item.bloqueado ? ETIQUETA_BLOQUEADO : ""].filter(Boolean)
}

export function diferenciaEtiquetas(actuales: string[], item: ItemClickUp): { agregar: string[]; quitar: string[] } {
  const deseadas = etiquetasDeItem(item)
  const deseadasNorm = deseadas.map(normalizarEtiqueta)
  const actualesNorm = actuales.map(normalizarEtiqueta)
  return {
    agregar: deseadas.filter((etiqueta) => !actualesNorm.includes(normalizarEtiqueta(etiqueta))),
    quitar: actuales.filter((etiqueta) => {
      const nombre = normalizarEtiqueta(etiqueta)
      return ETIQUETAS_GESTIONADAS.includes(nombre) && !deseadasNorm.includes(nombre)
    }),
  }
}

export interface OpcionesTarea {
  estadoClickUp: string | undefined
  asignadoId: number | null
}

export function construirCuerpoCreacion(item: ItemClickUp, { estadoClickUp, asignadoId }: OpcionesTarea): Record<string, unknown> {
  const descripcion = construirDescripcion(item)
  return {
    name: item.titulo,
    description: descripcion,
    markdown_content: descripcion,
    ...(estadoClickUp ? { status: estadoClickUp } : {}),
    ...(prioridadAClickUp(item) !== null ? { priority: prioridadAClickUp(item) } : {}),
    assignees: asignadoId === null ? [] : [asignadoId],
    tags: etiquetasDeItem(item),
    ...(item.plan_ini ? { start_date: fechaAMs(item.plan_ini), start_date_time: false } : {}),
    ...(item.fecha_compromiso ? { due_date: fechaAMs(item.fecha_compromiso), due_date_time: false } : {}),
  }
}

export function construirCuerpoActualizacion(
  item: ItemClickUp,
  { estadoClickUp, asignadoId }: OpcionesTarea,
  asignadosActuales: number[],
  prioridadActual: number | null = null,
): Record<string, unknown> {
  const descripcion = construirDescripcion(item)
  const deseados = asignadoId === null ? [] : [asignadoId]
  const prioridad = prioridadAClickUp(item)
  return {
    name: item.titulo,
    description: descripcion,
    markdown_content: descripcion,
    ...(estadoClickUp ? { status: estadoClickUp } : {}),
    ...(prioridad !== prioridadActual ? { priority: prioridad } : {}),
    assignees: {
      add: deseados.filter((id) => !asignadosActuales.includes(id)),
      rem: asignadosActuales.filter((id) => !deseados.includes(id)),
    },
    start_date: item.plan_ini ? fechaAMs(item.plan_ini) : null,
    start_date_time: false,
    due_date: item.fecha_compromiso ? fechaAMs(item.fecha_compromiso) : null,
    due_date_time: false,
  }
}

export const normalizarEstado = (nombre: string): string =>
  nombre.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "")

export function estadoClickUpDe(mapeo: MapeoEstados, estadoApp: string): string | undefined {
  const valor = mapeo[estadoApp]
  const nombres = Array.isArray(valor) ? valor : [valor]
  return nombres.find((nombre) => typeof nombre === "string" && nombre.trim() !== "")
}

export function mapeosDeMovimiento(
  actual: TareaClickUp,
  destino: ListaClickUp,
  estadoObjetivo: string | undefined,
): MapeoEstadoMovimiento[] {
  const origen = actual.status
  const estados = destino.statuses ?? []
  if (!origen?.id || estados.some((estado) => normalizarEstado(estado.status) === normalizarEstado(origen.status))) return []
  const elegido =
    estados.find((estado) => estadoObjetivo && normalizarEstado(estado.status) === normalizarEstado(estadoObjetivo)) ??
    estados.find((estado) => estado.type === "open") ??
    estados[0]
  return elegido?.id ? [{ source_status: origen.id, destination_status: elegido.id }] : []
}
