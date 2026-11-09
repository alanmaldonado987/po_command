import { consultar, supabase } from '../lib/supabase'

export const listarPersonas = () => consultar(supabase.from('v_persona').select('*').order('nombre'))

export const guardarPersona = ({ datos, clienteIds, id = null }) =>
  consultar(supabase.rpc('guardar_persona', { p_data: datos, p_clientes: clienteIds, p_id: id }))

export const eliminarPersona = (id) => consultar(supabase.from('persona').delete().eq('id', id))
