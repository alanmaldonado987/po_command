import { usarAutorizador } from "../_shared/autorizacion.ts"
usarAutorizador(() => Promise.resolve(true))
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1"
import { manejador } from "../ia/manejador.ts"

const VARIABLES = ["IA_BASE_URL", "IA_MODEL", "IA_API_KEY"]

async function llamar(cuerpo: unknown): Promise<{ estado: number; datos: Record<string, unknown> }> {
  const respuesta = await manejador(new Request("http://localhost/functions/v1/ia", { method: "POST", body: JSON.stringify(cuerpo) }))
  return { estado: respuesta.status, datos: await respuesta.json() }
}

async function conEntorno(valores: Record<string, string>, prueba: () => Promise<void>) {
  const previas = VARIABLES.map((nombre) => [nombre, Deno.env.get(nombre)] as const)
  VARIABLES.forEach((nombre) => Deno.env.delete(nombre))
  Object.entries(valores).forEach(([nombre, valor]) => Deno.env.set(nombre, valor))
  try {
    await prueba()
  } finally {
    VARIABLES.forEach((nombre) => Deno.env.delete(nombre))
    previas.forEach(([nombre, valor]) => valor !== undefined && Deno.env.set(nombre, valor))
  }
}

async function conFetch(respuesta: Response, prueba: (llamadas: { url: string; init: RequestInit }[]) => Promise<void>) {
  const original = globalThis.fetch
  const llamadas: { url: string; init: RequestInit }[] = []
  globalThis.fetch = ((url: string, init: RequestInit) => {
    llamadas.push({ url, init })
    return Promise.resolve(respuesta)
  }) as typeof fetch
  try {
    await prueba(llamadas)
  } finally {
    globalThis.fetch = original
  }
}

Deno.test("estado sin modelo configurado indica que no está disponible", async () => {
  await conEntorno({}, async () => {
    assertEquals((await llamar({ accion: "estado" })).datos, { disponible: false, modelo: null })
  })
})

Deno.test("estado con modelo configurado informa su nombre", async () => {
  await conEntorno({ IA_BASE_URL: "http://localhost:11434/v1/", IA_MODEL: "llama3.1" }, async () => {
    assertEquals((await llamar({ accion: "estado" })).datos, { disponible: true, modelo: "llama3.1" })
  })
})

Deno.test("sin la URL o sin el modelo no se considera disponible", async () => {
  await conEntorno({ IA_BASE_URL: "http://x/v1" }, async () => {
    assertEquals((await llamar({ accion: "estado" })).datos.disponible, false)
  })
  await conEntorno({ IA_MODEL: "m" }, async () => {
    assertEquals((await llamar({ accion: "estado" })).datos.disponible, false)
  })
})

Deno.test("redactar sin modelo configurado es 400", async () => {
  await conEntorno({}, async () => {
    const { estado, datos } = await llamar({ accion: "redactar", pregunta: "hola", borrador: "x", historial: [] })
    assertEquals(estado, 400)
    assertEquals(datos, { error: "No hay un modelo de lenguaje configurado" })
  })
})

Deno.test("redactar llama al modelo con el borrador, el historial recortado y la clave", async () => {
  const respuesta = Response.json({ choices: [{ message: { content: "Texto pulido" } }] })
  await conEntorno({ IA_BASE_URL: "http://localhost:11434/v1/", IA_MODEL: "llama3.1", IA_API_KEY: "clave" }, async () => {
    await conFetch(respuesta, async (llamadas) => {
      const historial = Array.from({ length: 8 }, (_, n) => ({ role: n % 2 ? "assistant" : "user", content: `m${n}` }))
      const { estado, datos } = await llamar({ accion: "redactar", pregunta: "¿Qué hay?", borrador: "DATOS", historial })
      assertEquals(estado, 200)
      assertEquals(datos, { texto: "Texto pulido" })
      assertEquals(llamadas.length, 1)
      assertEquals(llamadas[0].url, "http://localhost:11434/v1/chat/completions")
      const cabeceras = llamadas[0].init.headers as Record<string, string>
      assertEquals(cabeceras.Authorization, "Bearer clave")
      const cuerpo = JSON.parse(String(llamadas[0].init.body))
      assertEquals(cuerpo.model, "llama3.1")
      assertEquals(cuerpo.messages.length, 8)
      assertEquals(cuerpo.messages[0].role, "system")
      assertStringIncludes(cuerpo.messages[0].content, "BORRADOR CON DATOS:\nDATOS")
      assertEquals(cuerpo.messages[1].content, "m2")
      assertEquals(cuerpo.messages[7], { role: "user", content: "¿Qué hay?" })
    })
  })
})

Deno.test("redactar sin clave no envía la cabecera Authorization", async () => {
  const respuesta = Response.json({ choices: [{ message: { content: "ok" } }] })
  await conEntorno({ IA_BASE_URL: "http://localhost:11434/v1", IA_MODEL: "m" }, async () => {
    await conFetch(respuesta, async (llamadas) => {
      await llamar({ accion: "redactar", pregunta: "a", borrador: "b" })
      assert(!("Authorization" in (llamadas[0].init.headers as Record<string, string>)))
    })
  })
})

Deno.test("redactar con el modelo caído devuelve 500 con el código recibido", async () => {
  await conEntorno({ IA_BASE_URL: "http://localhost:11434/v1", IA_MODEL: "m" }, async () => {
    await conFetch(new Response("error", { status: 503 }), async () => {
      const { estado, datos } = await llamar({ accion: "redactar", pregunta: "a", borrador: "b" })
      assertEquals(estado, 500)
      assertEquals(datos, { error: "El modelo respondió 503" })
    })
  })
})

Deno.test("una acción desconocida es 400", async () => {
  const { estado, datos } = await llamar({ accion: "otra" })
  assertEquals(estado, 400)
  assertEquals(datos, { error: "Acción desconocida: otra" })
})
