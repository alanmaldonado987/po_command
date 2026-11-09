import { assertEquals } from "jsr:@std/assert@1"
import { usarAutorizador, usarVerificadorServicio } from "../_shared/autorizacion.ts"
import { manejar } from "../_shared/respuesta.ts"
import { usarCliente } from "../_shared/supabase.ts"
import type { SupabaseClient } from "npm:@supabase/supabase-js@2"

const procesar = manejar(() => Promise.resolve({ ok: true }))
const peticion = (token?: string) =>
  new Request("http://localhost/", {
    method: "POST",
    body: "{}",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

const clienteConUsuarios = (usuarios: Record<string, boolean>) =>
  ({
    auth: {
      getUser: (token: string) =>
        Promise.resolve(
          usuarios[token]
            ? { data: { user: { id: "u1" } }, error: null }
            : { data: { user: null }, error: { message: "invalid JWT" } },
        ),
    },
  }) as unknown as SupabaseClient

function conAutorizacionReal(prueba: () => Promise<void>) {
  return async () => {
    usarAutorizador()
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "clave-servicio")
    usarCliente(clienteConUsuarios({ "token-usuario": true }))
    usarVerificadorServicio((token) => Promise.resolve(token === "clave-servicio-rotada"))
    try {
      await prueba()
    } finally {
      usarVerificadorServicio()
      usarCliente(undefined)
      usarAutorizador(() => Promise.resolve(true))
    }
  }
}

Deno.test("rechaza peticiones sin token", conAutorizacionReal(async () => {
  assertEquals((await procesar(peticion())).status, 401)
}))

Deno.test("rechaza la clave anon u otros tokens que no pertenecen a un usuario", conAutorizacionReal(async () => {
  const respuesta = await procesar(peticion("clave-anon"))
  assertEquals(respuesta.status, 401)
  assertEquals((await respuesta.json()).error, "No autorizado")
}))

Deno.test("acepta la sesión de un usuario autenticado", conAutorizacionReal(async () => {
  assertEquals((await procesar(peticion("token-usuario"))).status, 200)
}))

Deno.test("acepta la clave de servicio del programador", conAutorizacionReal(async () => {
  assertEquals((await procesar(peticion("clave-servicio"))).status, 200)
}))

Deno.test("acepta una clave service_role válida aunque no sea idéntica a la del entorno", conAutorizacionReal(async () => {
  assertEquals((await procesar(peticion("clave-servicio-rotada"))).status, 200)
}))

Deno.test("las peticiones OPTIONS no requieren token", conAutorizacionReal(async () => {
  const respuesta = await procesar(new Request("http://localhost/", { method: "OPTIONS" }))
  assertEquals(respuesta.status, 200)
}))
