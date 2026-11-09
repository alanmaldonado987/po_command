import { createClient } from "npm:@supabase/supabase-js@2"
import { admin } from "./supabase.ts"

type Autorizador = (peticion: Request) => Promise<boolean>
type VerificadorServicio = (token: string) => Promise<boolean>

const tokenDe = (peticion: Request): string =>
  (peticion.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim()

// Las rutas de administración de Auth solo las acepta una clave service_role válida;
// así se reconoce al programador aunque la clave no sea idéntica a la variable del entorno.
const verificarClaveDeServicio: VerificadorServicio = async (token) => {
  const cliente = createClient(Deno.env.get("SUPABASE_URL")!, token, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await cliente.auth.admin.listUsers({ page: 1, perPage: 1 })
  return !error
}

let verificadorServicio: VerificadorServicio = verificarClaveDeServicio

export function usarVerificadorServicio(reemplazo?: VerificadorServicio): void {
  verificadorServicio = reemplazo ?? verificarClaveDeServicio
}

const autorizarSesionOServicio: Autorizador = async (peticion) => {
  const token = tokenDe(peticion)
  if (!token) return false
  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return true
  const { data, error } = await admin.auth.getUser(token)
  if (!error && data.user) return true
  return await verificadorServicio(token)
}

let autorizador: Autorizador = autorizarSesionOServicio

export const autorizar = (peticion: Request): Promise<boolean> => autorizador(peticion)

export function usarAutorizador(reemplazo?: Autorizador): void {
  autorizador = reemplazo ?? autorizarSesionOServicio
}
