import { consultar, consultarTodo, supabase } from '../lib/supabase'

export async function obtenerConfiguracion() {
  const filas = await consultar(supabase.from('config').select('clave, valor'))
  return Object.fromEntries(filas.map(({ clave, valor }) => [clave, valor]))
}

export const guardarConfiguracion = (clave, valor) =>
  consultar(supabase.from('config').upsert({ clave, valor }, { onConflict: 'clave' }))

export const listarAuditoria = (limite = 500) =>
  consultar(
    supabase
      .from('auditoria')
      .select('id, fecha, entidad, entidad_id, accion, detalle')
      .order('id', { ascending: false })
      .limit(limite),
  )

export const importarPlan = (filas, simular) =>
  consultar(supabase.rpc('importar_plan', { p_filas: filas, p_simular: simular }))

export const TABLAS_EXPORTABLES = [
  'producto',
  'cliente',
  'actividad',
  'modulo',
  'item',
  'nota',
  'persona',
  'persona_cliente',
  'bloqueante',
  'ceremonia',
  'acuerdo',
  'regla_alerta',
  'alerta_programada',
  'notificacion_log',
  'auditoria',
]

const COLUMNA_ORDEN = { persona_cliente: 'persona_id' }

export const leerTabla = (tabla) =>
  consultarTodo(() =>
    supabase
      .from(tabla)
      .select('*')
      .order(COLUMNA_ORDEN[tabla] ?? 'id'),
  )
