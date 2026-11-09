import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2"

let cliente: SupabaseClient | undefined

const crearCliente = (): SupabaseClient =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  })

export function usarCliente(reemplazo: SupabaseClient | undefined): void {
  cliente = reemplazo
}

export const admin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_destino, propiedad) {
    cliente ??= crearCliente()
    const valor = Reflect.get(cliente, propiedad)
    return typeof valor === "function" ? valor.bind(cliente) : valor
  },
})

interface Resultado<T> {
  data: T | null
  error: { message: string } | null
}

export async function consultar<T>(consulta: PromiseLike<Resultado<T>>): Promise<T> {
  const { data, error } = await consulta
  if (error) throw new Error(error.message)
  return data as T
}
