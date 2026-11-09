import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env')
}

export const supabase = createClient(url, anonKey)

export async function consultar(promesa) {
  const { data, error } = await promesa
  if (error) throw new Error(error.message)
  return data
}

const TAMANO_PAGINA = 1000

export async function consultarTodo(crearConsulta) {
  const filas = []
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const pagina = await consultar(crearConsulta().range(desde, desde + TAMANO_PAGINA - 1))
    filas.push(...pagina)
    if (pagina.length < TAMANO_PAGINA) return filas
  }
}

export async function invocarFuncion(nombre, cuerpo = {}) {
  const { data, error } = await supabase.functions.invoke(nombre, { body: cuerpo })
  if (error) {
    const detalle = await error.context?.json?.().catch(() => null)
    throw new Error(detalle?.error ?? error.message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}
