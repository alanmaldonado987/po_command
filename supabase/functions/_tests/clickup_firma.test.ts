import { assertEquals } from "jsr:@std/assert@1"
import { firmar, firmaValida } from "../_shared/clickup_firma.ts"

const VECTOR = "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8"
const MENSAJE = "The quick brown fox jumps over the lazy dog"

Deno.test("firmar produce el HMAC-SHA256 en hexadecimal (vector conocido)", async () => {
  assertEquals(await firmar(MENSAJE, "key"), VECTOR)
})

Deno.test("acepta una firma correcta, sin importar mayúsculas ni espacios", async () => {
  assertEquals(await firmaValida(MENSAJE, VECTOR, "key"), true)
  assertEquals(await firmaValida(MENSAJE, ` ${VECTOR.toUpperCase()} `, "key"), true)
})

Deno.test("rechaza una firma de otro cuerpo, de otro secreto o alterada", async () => {
  assertEquals(await firmaValida(`${MENSAJE}.`, VECTOR, "key"), false)
  assertEquals(await firmaValida(MENSAJE, VECTOR, "otra"), false)
  assertEquals(await firmaValida(MENSAJE, VECTOR.replace(/.$/, "0"), "key"), false)
})

Deno.test("rechaza firmas ausentes, vacías o de otra longitud", async () => {
  assertEquals(await firmaValida(MENSAJE, null, "key"), false)
  assertEquals(await firmaValida(MENSAJE, "", "key"), false)
  assertEquals(await firmaValida(MENSAJE, VECTOR.slice(0, 20), "key"), false)
})

Deno.test("sin secreto configurado nunca valida, aunque llegue una firma bien formada", async () => {
  assertEquals(await firmaValida(MENSAJE, VECTOR, ""), false)
})

Deno.test("la firma depende del cuerpo crudo: un espacio extra la invalida", async () => {
  const cuerpo = '{"event":"taskUpdated","task_id":"1"}'
  const firma = await firmar(cuerpo, "s")
  assertEquals(await firmaValida(cuerpo, firma, "s"), true)
  assertEquals(await firmaValida(cuerpo.replace(":", ": "), firma, "s"), false)
})
