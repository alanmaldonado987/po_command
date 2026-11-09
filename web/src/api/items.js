import { consultar, consultarTodo, supabase } from '../lib/supabase'

export const listarItems = () =>
  consultarTodo(() =>
    supabase
      .from('v_item')
      .select('*')
      .order('cliente')
      .order('actividad')
      .order('modulo')
      .order('funcionalidad')
      .order('alcance')
      .order('id'),
  )

export const guardarItem = ({ datos, id = null, nota = '', tipoNota = 'Seguimiento', autor = '' }) =>
  consultar(
    supabase.rpc('guardar_item', {
      p_data: datos,
      p_id: id,
      p_nota: nota,
      p_tipo_nota: tipoNota,
      p_autor: autor,
    }),
  )

export const eliminarItem = (id) => consultar(supabase.rpc('eliminar_item', { p_id: id }))

export const listarNotas = (itemId) =>
  consultar(
    supabase
      .from('nota')
      .select('*')
      .eq('item_id', itemId)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false }),
  )

export const listarTodasLasNotas = () =>
  consultarTodo(() => supabase.from('nota').select('id, item_id, tipo, fecha, texto').order('id'))

export const eliminarNota = (id) => consultar(supabase.from('nota').delete().eq('id', id))

export const listarBloqueantesAbiertos = () =>
  consultar(supabase.from('v_bloqueante_abierto').select('*').order('abierto_en'))

export const listarBloqueantes = () =>
  consultarTodo(() => supabase.from('bloqueante').select('id, item_id, abierto_en, resuelto_en').order('id'))
