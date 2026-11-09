import type { ClienteClickUp } from "../_shared/clickup_api.ts"
import { ErrorClickUp } from "../_shared/clickup_api.ts"
import { usarFabricaClickUp } from "../_shared/clickup_config.ts"
import type {
  CarpetaClickUp,
  EquipoClickUp,
  EspacioClickUp,
  ListaClickUp,
  MapeoEstadoMovimiento,
  TareaClickUp,
  UsuarioClickUp,
} from "../_shared/clickup_tipos.ts"
import { crearEntorno } from "./entorno.ts"
import type { Fila } from "./base_falsa.ts"

type Cuerpo = Record<string, unknown>

export class ClienteFalso {
  llamadas: { metodo: string; argumentos: unknown[] }[] = []
  fallos: Record<string, Error[]> = {}
  tareas = new Map<string, TareaClickUp>()
  usuarioActual: UsuarioClickUp = { id: 1, username: "vero", email: "vero@ises.com.co" }
  equiposActuales: EquipoClickUp[] = []
  espaciosPorEquipo: Record<string, EspacioClickUp[]> = {}
  carpetasPorEspacio: Record<string, CarpetaClickUp[]> = {}
  listasPorEspacio: Record<string, ListaClickUp[]> = {}
  detalleListas: Record<string, ListaClickUp> = {}
  tareasPorLista: Record<string, TareaClickUp[]> = {}
  archivadasPorLista: Record<string, TareaClickUp[]> = {}
  webhook = { id: "wh-1", secret: "secreto-webhook" }
  reloj = 1_800_000_000_000
  private contador = 0

  private llamar<T>(metodo: string, argumentos: unknown[], resultado: () => T): Promise<T> {
    this.llamadas.push({ metodo, argumentos })
    const error = this.fallos[metodo]?.shift()
    return error ? Promise.reject(error) : Promise.resolve().then(resultado)
  }

  llamadasDe(metodo: string): unknown[][] {
    return this.llamadas.filter((llamada) => llamada.metodo === metodo).map((llamada) => llamada.argumentos)
  }

  fallar(metodo: string, ...errores: Error[]): void {
    this.fallos[metodo] = [...(this.fallos[metodo] ?? []), ...errores]
  }

  usuario(): Promise<UsuarioClickUp> {
    return this.llamar("usuario", [], () => this.usuarioActual)
  }

  equipos(): Promise<EquipoClickUp[]> {
    return this.llamar("equipos", [], () => this.equiposActuales)
  }

  espacios(equipoId: string): Promise<EspacioClickUp[]> {
    return this.llamar("espacios", [equipoId], () => this.espaciosPorEquipo[equipoId] ?? [])
  }

  carpetas(espacioId: string): Promise<CarpetaClickUp[]> {
    return this.llamar("carpetas", [espacioId], () => this.carpetasPorEspacio[espacioId] ?? [])
  }

  listasSinCarpeta(espacioId: string): Promise<ListaClickUp[]> {
    return this.llamar("listasSinCarpeta", [espacioId], () => this.listasPorEspacio[espacioId] ?? [])
  }

  lista(listaId: string): Promise<ListaClickUp> {
    return this.llamar("lista", [listaId], () => this.detalleListas[listaId] ?? { id: listaId, name: listaId, statuses: [] })
  }

  tareasDeLista(listaId: string, archivadas = false): Promise<TareaClickUp[]> {
    return this.llamar("tareasDeLista", [listaId, archivadas], () => (archivadas ? this.archivadasPorLista : this.tareasPorLista)[listaId] ?? [])
  }

  tarea(tareaId: string): Promise<TareaClickUp> {
    return this.llamar("tarea", [tareaId], () => {
      const tarea = this.tareas.get(tareaId)
      if (!tarea) throw new ErrorClickUp("Task not found", 404, "ITEM_015")
      return structuredClone(tarea)
    })
  }

  crearTarea(listaId: string, cuerpo: Cuerpo): Promise<TareaClickUp> {
    return this.llamar("crearTarea", [listaId, cuerpo], () => {
      this.contador += 1
      const tarea: TareaClickUp = {
        id: `T-${this.contador}`,
        name: String(cuerpo.name),
        date_updated: String(this.reloj),
        due_date: null,
        start_date: null,
        url: `https://app.clickup.com/t/T-${this.contador}`,
        list: { id: listaId },
      }
      this.tareas.set(tarea.id, tarea)
      return structuredClone(tarea)
    })
  }

  actualizarTarea(tareaId: string, cuerpo: Cuerpo): Promise<TareaClickUp> {
    return this.llamar("actualizarTarea", [tareaId, cuerpo], () => {
      this.reloj += 1000
      const tarea = this.tareas.get(tareaId) ?? ({ id: tareaId, name: "", due_date: null, start_date: null } as TareaClickUp)
      tarea.date_updated = String(this.reloj)
      this.tareas.set(tareaId, tarea)
      return structuredClone(tarea)
    })
  }

  moverTarea(equipoId: string, tareaId: string, listaId: string, estados: MapeoEstadoMovimiento[]): Promise<void> {
    return this.llamar("moverTarea", [equipoId, tareaId, listaId, estados], () => {
      this.reloj += 1000
      const tarea = this.tareas.get(tareaId)
      if (tarea) {
        tarea.list = { id: listaId }
        tarea.date_updated = String(this.reloj)
      }
    })
  }

  comentarTarea(tareaId: string, texto: string): Promise<void> {
    return this.llamar("comentarTarea", [tareaId, texto], () => undefined)
  }

  agregarEtiqueta(tareaId: string, etiqueta: string): Promise<void> {
    return this.llamar("agregarEtiqueta", [tareaId, etiqueta], () => undefined)
  }

  quitarEtiqueta(tareaId: string, etiqueta: string): Promise<void> {
    return this.llamar("quitarEtiqueta", [tareaId, etiqueta], () => undefined)
  }

  crearWebhook(equipoId: string, endpoint: string): Promise<{ id: string; secret: string }> {
    return this.llamar("crearWebhook", [equipoId, endpoint], () => this.webhook)
  }

  eliminarWebhook(webhookId: string): Promise<void> {
    return this.llamar("eliminarWebhook", [webhookId], () => undefined)
  }
}

export const tareaClickUp = (extra: Partial<TareaClickUp> = {}): TareaClickUp => ({
  id: "T-1",
  name: "Mapa de rutas",
  status: { status: "en desarrollo" },
  date_updated: "1800000000000",
  assignees: [],
  tags: [],
  due_date: null,
  start_date: null,
  url: "https://app.clickup.com/t/T-1",
  list: { id: "L-1" },
  ...extra,
})

export const configClickUp = (extra: Fila = {}): Fila => ({
  id: true,
  habilitado: true,
  token: "pk_token",
  equipo_id: "EQ-1",
  equipo_nombre: "Ises",
  webhook_id: null,
  webhook_secret: "",
  mapeo_estados: {
    "No iniciado": "pendiente",
    "En curso": "en desarrollo",
    "Terminado, en etapa de pruebas": "validación",
    Terminado: "entregado",
    Suspendido: "suspendido",
  },
  ultimo_sync: null,
  ...extra,
})

export const destino = (extra: Fila = {}): Fila => ({
  id: 1,
  tablero_id: null,
  cliente_id: 1,
  lista_id: "L-1",
  lista_nombre: "AIR-E",
  ...extra,
})

export const tablero = (extra: Fila = {}): Fila => ({ id: 1, nombre: "Desarrollo", mapeo_estados: null, ...extra })

export const itemVinculable = (extra: Fila = {}): Fila => ({
  id: 10,
  codigo: "BL-010",
  titulo: "Mapa de rutas",
  funcionalidad: "Mapa de rutas",
  descripcion: "",
  estado: "En curso",
  bloqueado: false,
  motivo_bloqueo: "",
  producto: "FieldOps",
  cliente_id: 1,
  cliente: "AIR-E",
  actividad: "SCR",
  modulo: "Torre de Control",
  fase: "Desarrollo",
  alcance: "Web",
  responsable_id: null,
  responsable_correo: null,
  plan_ini: null,
  plan_fin: null,
  plan_pruebas_ini: null,
  plan_pruebas_fin: null,
  real_ini: null,
  real_fin: null,
  real_pruebas_ini: null,
  real_pruebas_fin: null,
  fecha_compromiso: null,
  tablero_id: null,
  tablero: null,
  clickup_task_id: null,
  clickup_url: null,
  clickup_lista_id: null,
  eliminado_en: null,
  ...extra,
})

export function entornoClickUp(datos: Record<string, Fila[]> = {}) {
  const entorno = crearEntorno({
    clickup_config: [configClickUp()],
    clickup_destino: [destino()],
    clickup_tablero: [],
    clickup_cola: [],
    item: [],
    v_item: [],
    ...datos,
  })
  const cliente = new ClienteFalso()
  usarFabricaClickUp(() => cliente as unknown as ClienteClickUp)
  entorno.base.manejadoresRpc.contar_items_sin_destino_clickup = () => 0
  entorno.base.manejadoresRpc.reservar_cola_clickup = () => {
    const pendientes = entorno.base
      .filas("clickup_cola")
      .filter((fila) => fila.estado === "Pendiente" && !fila.reservada_hasta)
    pendientes.forEach((fila) => (fila.reservada_hasta = "reservada"))
    return pendientes.map((fila) => structuredClone(fila))
  }
  return { ...entorno, cliente }
}

export const filaCola = (extra: Fila = {}): Fila => ({
  id: 1,
  item_id: 10,
  accion: "create",
  estado: "Pendiente",
  intentos: 0,
  error: null,
  reservada_hasta: null,
  ...extra,
})
