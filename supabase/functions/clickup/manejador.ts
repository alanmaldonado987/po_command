import { ClienteClickUp, ErrorClickUp } from "../_shared/clickup_api.ts"
import { sincronizar } from "../_shared/clickup_cola.ts"
import {
  clienteClickUp,
  guardarConfigClickUp,
  listarDestinos,
  listarTableros,
  obtenerConfigClickUp,
} from "../_shared/clickup_config.ts"
import { importarExistentes, reconciliar } from "../_shared/clickup_reconciliar.ts"
import { ESTADOS_APP, type ConfigClickUp, type ListaClickUp, type MapeoEstados } from "../_shared/clickup_tipos.ts"
import { ErrorSolicitud, exigir, manejar } from "../_shared/respuesta.ts"
import { admin, consultar } from "../_shared/supabase.ts"

type Cuerpo = Record<string, unknown>

const esTexto = (valor: unknown): valor is string => typeof valor === "string" && valor.trim() !== ""

const EXPLICACIONES: Record<number, string> = {
  401: "ClickUp rechazó el token. Usa tu token personal (ClickUp → Configuración → Apps → API Token).",
  403: "El token no tiene permisos sobre ese recurso o tu plan no incluye esta función.",
  429: "ClickUp limitó las peticiones. Espera un minuto y vuelve a intentar.",
}

async function contarCola(estado: string): Promise<number> {
  const { count, error } = await admin.from("clickup_cola").select("*", { count: "exact", head: true }).eq("estado", estado)
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function estaConectado(config: ConfigClickUp): Promise<boolean> {
  if (!config.token) return false
  try {
    await (await clienteClickUp(config)).usuario()
    return true
  } catch {
    return false
  }
}

const contarSinDestino = (): Promise<number> => consultar<number>(admin.rpc("contar_items_sin_destino_clickup"))

async function resumenTableros() {
  const [tableros, destinos] = await Promise.all([listarTableros(), listarDestinos()])
  return tableros.map(({ id, nombre, mapeo_estados }) => ({
    id,
    nombre,
    mapeo_estados,
    destinos: destinos.filter((destino) => destino.tablero_id === id).length,
  }))
}

async function estado() {
  const config = await obtenerConfigClickUp()
  const [pendientes, conError, conectado, tableros, sinDestino] = await Promise.all([
    contarCola("Pendiente"),
    contarCola("Fallida"),
    estaConectado(config),
    resumenTableros(),
    contarSinDestino(),
  ])
  return {
    habilitado: config.habilitado,
    token_configurado: Boolean(config.token),
    conectado,
    equipo: config.equipo_id ? { id: config.equipo_id, nombre: config.equipo_nombre } : null,
    webhook_registrado: Boolean(config.webhook_id),
    pendientes,
    con_error: conError,
    ultimo_sync: config.ultimo_sync,
    mapeo_estados: config.mapeo_estados,
    tableros,
    sin_destino: sinDestino,
  }
}

function validarNombresDeEstado(estadoApp: string, valor: unknown): string | string[] {
  if (typeof valor === "string") return valor
  exigir(
    Array.isArray(valor) && valor.every((nombre) => typeof nombre === "string"),
    `Los estados de ClickUp para «${estadoApp}» deben ser texto o una lista de textos`,
  )
  return (valor as string[]).map((nombre) => nombre.trim()).filter(Boolean)
}

function validarMapeo(mapeo: unknown): MapeoEstados {
  exigir(typeof mapeo === "object" && mapeo !== null && !Array.isArray(mapeo), "mapeo_estados debe ser un objeto")
  const entradas = Object.entries(mapeo as Record<string, unknown>)
  for (const [estadoApp] of entradas) {
    exigir(ESTADOS_APP.includes(estadoApp as (typeof ESTADOS_APP)[number]), `Estado desconocido en el mapeo: ${estadoApp}`)
  }
  return Object.fromEntries(entradas.map(([estadoApp, valor]) => [estadoApp, validarNombresDeEstado(estadoApp, valor)]))
}

async function nombreDelEquipo(config: ConfigClickUp, equipoId: string): Promise<string> {
  if (!config.token) return ""
  try {
    const equipos = await (await clienteClickUp(config)).equipos()
    return equipos.find((equipo) => equipo.id === equipoId)?.name ?? ""
  } catch {
    return ""
  }
}

async function guardarConfig(cuerpo: Cuerpo) {
  const actual = await obtenerConfigClickUp()
  const cambios: Partial<ConfigClickUp> = {}
  if (esTexto(cuerpo.token)) cambios.token = cuerpo.token.trim()
  if (cuerpo.habilitado !== undefined) {
    exigir(typeof cuerpo.habilitado === "boolean", "habilitado debe ser verdadero o falso")
    cambios.habilitado = cuerpo.habilitado
  }
  if (cuerpo.equipo_id !== undefined) {
    exigir(cuerpo.equipo_id === null || esTexto(cuerpo.equipo_id), "equipo_id inválido")
    cambios.equipo_id = cuerpo.equipo_id as string | null
    cambios.equipo_nombre = esTexto(cuerpo.equipo_nombre)
      ? cuerpo.equipo_nombre
      : cuerpo.equipo_id
        ? await nombreDelEquipo({ ...actual, ...cambios }, cuerpo.equipo_id as string)
        : ""
  }
  if (cuerpo.mapeo_estados !== undefined) cambios.mapeo_estados = validarMapeo(cuerpo.mapeo_estados)
  const resultante = { ...actual, ...cambios }
  exigir(!resultante.habilitado || (resultante.token && resultante.equipo_id), "Para habilitar la integración guarda primero el token y elige el equipo")
  await guardarConfigClickUp(cambios)
  return estado()
}

async function probar() {
  try {
    const cliente = await clienteClickUp()
    const [usuario, equipos] = await Promise.all([cliente.usuario(), cliente.equipos()])
    return { ok: true, usuario, equipos: equipos.map(({ id, name }) => ({ id, nombre: name })) }
  } catch (error) {
    if (!(error instanceof ErrorClickUp)) throw error
    return { ok: false, detalle: error.message, explicacion: EXPLICACIONES[error.estado] }
  }
}

async function estadosDe(cliente: ClienteClickUp, lista: ListaClickUp): Promise<string[]> {
  const estados = lista.statuses ?? (await cliente.lista(lista.id)).statuses ?? []
  return estados.map((e) => e.status)
}

async function describirLista(cliente: ClienteClickUp, lista: ListaClickUp) {
  return { id: lista.id, nombre: lista.name, estados: await estadosDe(cliente, lista) }
}

async function jerarquia({ equipo_id }: Cuerpo) {
  exigir(esTexto(equipo_id), "Falta equipo_id")
  const cliente = await clienteClickUp()
  const espacios = []
  for (const espacio of await cliente.espacios(equipo_id)) {
    const carpetas = []
    for (const carpeta of await cliente.carpetas(espacio.id)) {
      const listas = []
      for (const lista of carpeta.lists ?? []) listas.push(await describirLista(cliente, lista))
      carpetas.push({ id: carpeta.id, nombre: carpeta.name, listas })
    }
    const listas = []
    for (const lista of await cliente.listasSinCarpeta(espacio.id)) listas.push(await describirLista(cliente, lista))
    espacios.push({ id: espacio.id, nombre: espacio.name, carpetas, listas })
  }
  return { espacios }
}

async function registrarWebhook() {
  const config = await obtenerConfigClickUp()
  exigir(config.token && config.equipo_id, "Guarda el token y elige el equipo antes de registrar el webhook")
  const cliente = await clienteClickUp(config)
  if (config.webhook_id) await cliente.eliminarWebhook(config.webhook_id).catch(() => undefined)
  const endpoint = `${Deno.env.get("SUPABASE_URL")}/functions/v1/clickup-webhook`
  try {
    const webhook = await cliente.crearWebhook(config.equipo_id!, endpoint)
    await guardarConfigClickUp({ webhook_id: webhook.id, webhook_secret: webhook.secret })
    return { webhook_id: webhook.id }
  } catch (error) {
    if (!(error instanceof ErrorClickUp)) throw error
    throw new ErrorSolicitud(
      `No se pudo registrar el webhook (${error.message}). Si tu plan no lo permite, ClickUp → app se sincroniza igual por revisión periódica.`,
    )
  }
}

async function quitarWebhook() {
  const config = await obtenerConfigClickUp()
  if (config.webhook_id) await (await clienteClickUp(config)).eliminarWebhook(config.webhook_id).catch(() => undefined)
  await guardarConfigClickUp({ webhook_id: null, webhook_secret: "" })
  return estado()
}

async function encolarSinVincular() {
  return { encolados: await consultar<number>(admin.rpc("encolar_sin_vincular_clickup")) }
}

const esIdOpcional = (valor: unknown): boolean => valor === undefined || valor === null || typeof valor === "number"

async function importar({ lista_id, cliente_id, tablero_id }: Cuerpo) {
  exigir(esTexto(lista_id), "Falta lista_id")
  exigir(esIdOpcional(cliente_id), "cliente_id inválido")
  exigir(esIdOpcional(tablero_id), "tablero_id inválido")
  return {
    importadas: await importarExistentes(
      lista_id,
      (cliente_id as number | null | undefined) ?? null,
      (tablero_id as number | null | undefined) ?? null,
    ),
  }
}

function reconciliarTablero({ tablero_id, forzar }: Cuerpo) {
  exigir(esIdOpcional(tablero_id), "tablero_id inválido")
  exigir(forzar === undefined || typeof forzar === "boolean", "forzar debe ser verdadero o falso")
  return reconciliar((tablero_id as number | null | undefined) ?? null, forzar === true)
}

const ACCIONES: Record<string, (cuerpo: Cuerpo) => Promise<unknown>> = {
  estado,
  guardar_config: ({ valores, ...resto }) => guardarConfig((valores as Cuerpo | undefined) ?? resto),
  probar,
  jerarquia,
  registrar_webhook: registrarWebhook,
  quitar_webhook: quitarWebhook,
  sincronizar: () => sincronizar(),
  reconciliar: reconciliarTablero,
  importar_existentes: importar,
  encolar_sin_vincular: encolarSinVincular,
}

export const manejador = manejar((cuerpo) => {
  const accion = ACCIONES[cuerpo.accion as string]
  if (!accion) throw new ErrorSolicitud(`Acción desconocida: ${cuerpo.accion}`)
  return accion(cuerpo)
})
