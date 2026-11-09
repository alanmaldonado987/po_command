import { consultar, supabase } from '../lib/supabase'

const CAMPOS = {
  cliente: 'id, nombre, descripcion, estado',
  actividad: 'id, nombre, descripcion',
  modulo: 'id, nombre, descripcion, producto_id',
  producto: 'id, nombre, descripcion, estado',
}

export const listarCatalogo = (tabla) =>
  consultar(supabase.from(tabla).select(CAMPOS[tabla]).order('nombre'))

export const crearRegistro = (tabla, datos) =>
  consultar(supabase.from(tabla).insert(datos).select(CAMPOS[tabla]).single())

export const actualizarRegistro = (tabla, id, datos) =>
  consultar(supabase.from(tabla).update(datos).eq('id', id).select(CAMPOS[tabla]).single())

export const eliminarRegistro = (tabla, id) => consultar(supabase.from(tabla).delete().eq('id', id))
