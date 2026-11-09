import { consultar, supabase } from '../lib/supabase'

export const listarCeremonias = () =>
  consultar(supabase.from('v_ceremonia').select('*').order('fecha_hora'))

export const guardarCeremonia = ({ datos, id = null }) =>
  id
    ? consultar(supabase.from('ceremonia').update(datos).eq('id', id).select('id').single())
    : consultar(supabase.from('ceremonia').insert(datos).select('id').single())

export const eliminarCeremonia = (id) => consultar(supabase.rpc('eliminar_ceremonia', { p_id: id }))

export const listarAcuerdos = () =>
  consultar(supabase.from('v_acuerdo').select('*').order('fecha_limite', { nullsFirst: false }))

export const guardarAcuerdo = ({ datos, id = null }) =>
  id
    ? consultar(supabase.from('acuerdo').update(datos).eq('id', id).select('id').single())
    : consultar(supabase.from('acuerdo').insert(datos).select('id').single())

export const eliminarAcuerdo = (id) => consultar(supabase.from('acuerdo').delete().eq('id', id))
