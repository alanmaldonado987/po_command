import { consultar, invocarFuncion, supabase } from '../lib/supabase'

const LIMITE_COLA = 200
const LIMITE_LOG = 300

export const listarReglas = () => consultar(supabase.from('regla_alerta').select('*').order('id'))

export const actualizarRegla = (id, cambios) =>
  consultar(supabase.from('regla_alerta').update(cambios).eq('id', id))

export const listarCola = (estado) =>
  consultar(
    supabase
      .from('alerta_programada')
      .select('id, enviar_en, regla_codigo, asunto, destinatarios, intentos, error')
      .eq('estado', estado)
      .order('enviar_en', { ascending: false })
      .limit(LIMITE_COLA),
  )

export const listarProximasAlertas = (limite = 6) =>
  consultar(
    supabase
      .from('alerta_programada')
      .select('id, enviar_en, asunto, destinatarios')
      .eq('estado', 'Pendiente')
      .order('enviar_en')
      .limit(limite),
  )

export async function obtenerCuerpoAlerta(id) {
  const fila = await consultar(supabase.from('alerta_programada').select('cuerpo_html').eq('id', id).single())
  return fila.cuerpo_html
}

export const cancelarAlertas = (ids) =>
  consultar(
    supabase.from('alerta_programada').update({ estado: 'Cancelada' }).in('id', ids).eq('estado', 'Pendiente'),
  )

export const reintentarAlertas = (ids) =>
  consultar(
    supabase
      .from('alerta_programada')
      .update({ estado: 'Pendiente', enviar_en: new Date().toISOString(), error: null, intentos: 0 })
      .in('id', ids),
  )

export async function contarAlertas() {
  const inicioDia = new Date()
  inicioDia.setHours(0, 0, 0, 0)
  const contar = (consulta) => consulta.then(({ count, error }) => {
    if (error) throw new Error(error.message)
    return count
  })
  const [pendientes, fallidas, enviadasHoy] = await Promise.all([
    contar(supabase.from('alerta_programada').select('*', { count: 'exact', head: true }).eq('estado', 'Pendiente')),
    contar(supabase.from('alerta_programada').select('*', { count: 'exact', head: true }).eq('estado', 'Fallida')),
    contar(
      supabase
        .from('notificacion_log')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'Enviada')
        .gte('fecha', inicioDia.toISOString()),
    ),
  ])
  return { pendientes, fallidas, enviadasHoy }
}

export const listarLog = (limite = LIMITE_LOG) =>
  consultar(
    supabase
      .from('notificacion_log')
      .select('id, fecha, regla_codigo, asunto, destinatarios, estado, detalle')
      .order('id', { ascending: false })
      .limit(limite),
  )

export const listarAlertasPorRegla = () =>
  consultar(supabase.from('notificacion_log').select('regla_codigo, estado').not('regla_codigo', 'is', null))

const alertas = (accion, datos = {}) => invocarFuncion('alertas', { accion, ...datos })

export const revisarReglasAhora = () => alertas('tick')
export const despacharCola = () => alertas('despachar')
export const notificarItemGuardado = (resultadoGuardado) => alertas('item_guardado', { resultado: resultadoGuardado })
export const escalarBloqueo = (bloqueanteId) => alertas('escalar', { bloqueante_id: bloqueanteId })
export const enviarResumenSemanal = () => alertas('resumen')
export const recordarVencimientos = (itemIds) => alertas('recordar', { item_ids: itemIds })
export const invitarCeremonia = (ceremoniaId) => alertas('invitar_ceremonia', { ceremonia_id: ceremoniaId })
export const resolverDestinatarios = (consulta) => alertas('destinatarios', consulta)
