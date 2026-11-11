import { consultar, invocarFuncion, supabase } from '../lib/supabase'

const LIMITE_COLA = 30

const clickup = (accion, datos = {}) => invocarFuncion('clickup', { accion, ...datos })

export const obtenerEstadoClickUp = () => clickup('estado')
export const guardarConfigClickUp = (valores) => clickup('guardar_config', valores)
export const probarClickUp = () => clickup('probar')
export const obtenerJerarquiaClickUp = (equipoId) => clickup('jerarquia', { equipo_id: equipoId })
export const registrarWebhookClickUp = () => clickup('registrar_webhook')
export const quitarWebhookClickUp = () => clickup('quitar_webhook')
export const sincronizarClickUp = () => clickup('sincronizar')
export const reconciliarClickUp = ({ tableroId = null, forzar = false } = {}) =>
  clickup('reconciliar', { ...(tableroId !== null && { tablero_id: tableroId }), ...(forzar && { forzar: true }) })
export const importarExistentesClickUp = ({ listaId, clienteId = null, tableroId = null }) =>
  clickup('importar_existentes', { lista_id: listaId, cliente_id: clienteId, tablero_id: tableroId })

export const listarTableros = () =>
  consultar(supabase.from('clickup_tablero').select('id, nombre, mapeo_estados').order('nombre'))

export const crearTablero = ({ nombre }) =>
  consultar(supabase.from('clickup_tablero').insert({ nombre }).select('id, nombre, mapeo_estados').single())

export const actualizarTablero = ({ id, ...cambios }) => {
  const datos = {}
  if (cambios.nombre !== undefined) datos.nombre = cambios.nombre
  if (cambios.mapeoEstados !== undefined) datos.mapeo_estados = cambios.mapeoEstados
  return consultar(supabase.from('clickup_tablero').update(datos).eq('id', id).select('id').single())
}

export const eliminarTablero = (id) => consultar(supabase.from('clickup_tablero').delete().eq('id', id))

export const listarDestinos = () =>
  consultar(
    supabase.from('clickup_destino').select('id, tablero_id, cliente_id, lista_id, lista_nombre').order('id'),
  )

export const guardarDestino = ({ id = null, tableroId = null, clienteId = null, listaId, listaNombre }) => {
  const datos = { tablero_id: tableroId, cliente_id: clienteId, lista_id: listaId, lista_nombre: listaNombre }
  return id
    ? consultar(supabase.from('clickup_destino').update(datos).eq('id', id).select('id').single())
    : consultar(supabase.from('clickup_destino').insert(datos).select('id').single())
}

export const eliminarDestino = (id) => consultar(supabase.from('clickup_destino').delete().eq('id', id))

const COLUMNAS_COLA = 'id, item_id, accion, estado, intentos, error, creado_en, procesado_en'

export const listarColaClickUp = ({ estados = null, limite = LIMITE_COLA } = {}) => {
  const consulta = supabase.from('clickup_cola').select(COLUMNAS_COLA).order('id', { ascending: false }).limit(limite)
  return consultar(estados ? consulta.in('estado', estados) : consulta)
}

export const listarPendientesDeItem = (itemId) =>
  consultar(supabase.from('clickup_cola').select(COLUMNAS_COLA).eq('item_id', itemId).eq('estado', 'Pendiente'))
