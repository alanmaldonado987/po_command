const codificador = new TextEncoder()

const aHex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("")

export async function firmar(cuerpo: string, secreto: string): Promise<string> {
  const llave = await crypto.subtle.importKey("raw", codificador.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return aHex(await crypto.subtle.sign("HMAC", llave, codificador.encode(cuerpo)))
}

function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diferencia = 0
  for (let i = 0; i < a.length; i += 1) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diferencia === 0
}

export async function firmaValida(cuerpo: string, firma: string | null, secreto: string): Promise<boolean> {
  if (!firma || !secreto) return false
  return igualesEnTiempoConstante(await firmar(cuerpo, secreto), firma.trim().toLowerCase())
}
