import { admin, consultar } from "./supabase.ts"
import type { Regla } from "./tipos.ts"

export async function valorConfig(clave: string, defecto = ""): Promise<string> {
  const fila = await consultar<{ valor: string } | null>(admin.from("config").select("valor").eq("clave", clave).maybeSingle())
  return fila?.valor || defecto
}

export async function datosPo(): Promise<{ nombre: string; correo: string }> {
  const [nombre, correo] = await Promise.all([valorConfig("po_nombre", "Product Owner"), valorConfig("po_correo")])
  return { nombre, correo }
}

export const obtenerRegla = (codigo: string): Promise<Regla | null> =>
  consultar<Regla | null>(admin.from("regla_alerta").select("*").eq("codigo", codigo).maybeSingle())

export async function reglaActiva(codigo: string): Promise<Regla | null> {
  const regla = await obtenerRegla(codigo)
  return regla?.activa ? regla : null
}
