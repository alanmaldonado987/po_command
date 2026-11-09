import { ClienteClickUp } from "./clickup_api.ts"
import type {
  ConfigClickUp,
  DestinoClickUp,
  EquipoClickUp,
  MapeoEstados,
  TableroClickUp,
  UsuarioClickUp,
} from "./clickup_tipos.ts"
import { ErrorSolicitud } from "./respuesta.ts"
import { admin, consultar } from "./supabase.ts"

const VIGENCIA_MIEMBROS_MS = 10 * 60 * 1000

type Fabrica = (token: string) => ClienteClickUp

let fabrica: Fabrica | undefined
const cacheMiembros = new Map<string, { expira: number; usuarios: UsuarioClickUp[] }>()

export function usarFabricaClickUp(reemplazo?: Fabrica): void {
  fabrica = reemplazo
  cacheMiembros.clear()
}

export const obtenerConfigClickUp = (): Promise<ConfigClickUp> =>
  consultar<ConfigClickUp>(admin.from("clickup_config").select("*").single())

export async function guardarConfigClickUp(cambios: Partial<ConfigClickUp>): Promise<void> {
  await consultar(admin.from("clickup_config").update(cambios).eq("id", true))
}

export async function listarDestinos(): Promise<DestinoClickUp[]> {
  const destinos = await consultar<DestinoClickUp[]>(admin.from("clickup_destino").select("*").order("id"))
  return destinos.map((destino) => ({ ...destino, tablero_id: destino.tablero_id ?? null }))
}

export const listarTableros = (): Promise<TableroClickUp[]> =>
  consultar<TableroClickUp[]>(admin.from("clickup_tablero").select("*").order("id"))

const puntajeDestino = (destino: DestinoClickUp): number =>
  (destino.tablero_id !== null ? 2 : 0) + (destino.cliente_id !== null ? 1 : 0)

export function resolverDestino(
  destinos: DestinoClickUp[],
  tableroId: number | null,
  clienteId: number | null,
): DestinoClickUp | null {
  const candidatos = destinos.filter(
    (destino) =>
      (destino.tablero_id === null || destino.tablero_id === tableroId) &&
      (destino.cliente_id === null || destino.cliente_id === clienteId),
  )
  return candidatos.sort((a, b) => puntajeDestino(b) - puntajeDestino(a))[0] ?? null
}

export async function destinoDe(tableroId: number | null, clienteId: number | null): Promise<DestinoClickUp | null> {
  return resolverDestino(await listarDestinos(), tableroId, clienteId)
}

export const mapeoEfectivo = (config: ConfigClickUp, tableros: TableroClickUp[], tableroId: number | null): MapeoEstados => ({
  ...config.mapeo_estados,
  ...(tableros.find((tablero) => tablero.id === tableroId)?.mapeo_estados ?? {}),
})

export function crearClienteClickUp(token: string): ClienteClickUp {
  return fabrica ? fabrica(token) : new ClienteClickUp(token)
}

export async function clienteClickUp(config?: ConfigClickUp): Promise<ClienteClickUp> {
  const actual = config ?? (await obtenerConfigClickUp())
  if (!actual.token) throw new ErrorSolicitud("Falta el token de ClickUp: guárdalo en la configuración de la integración")
  return crearClienteClickUp(actual.token)
}

export async function miembrosDelEquipo(cliente: ClienteClickUp, equipoId: string | null): Promise<UsuarioClickUp[]> {
  if (!equipoId) return []
  const vigente = cacheMiembros.get(equipoId)
  if (vigente && vigente.expira > Date.now()) return vigente.usuarios
  const equipos: EquipoClickUp[] = await cliente.equipos()
  const equipo = equipos.find((e) => e.id === equipoId)
  const usuarios = (equipo?.members ?? []).map((m) => m.user)
  cacheMiembros.set(equipoId, { expira: Date.now() + VIGENCIA_MIEMBROS_MS, usuarios })
  return usuarios
}

export async function asignadoPorCorreo(
  cliente: ClienteClickUp,
  equipoId: string | null,
  correo: string | null,
): Promise<number | null> {
  if (!correo) return null
  const miembros = await miembrosDelEquipo(cliente, equipoId)
  return miembros.find((m) => m.email?.toLowerCase() === correo.toLowerCase())?.id ?? null
}
