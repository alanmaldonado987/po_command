import { ErrorSolicitud } from "./respuesta.ts"

const TIEMPO_MAXIMO_MS = 120_000
const MENSAJES_HISTORIAL = 6

interface Mensaje {
  role: string
  content: string
}

export interface ProveedorModelo {
  base: string
  modelo: string
  clave: string
}

export function proveedor(): ProveedorModelo | null {
  const base = (Deno.env.get("IA_BASE_URL") ?? "").replace(/\/+$/, "")
  const modelo = Deno.env.get("IA_MODEL") ?? ""
  return base && modelo ? { base, modelo, clave: Deno.env.get("IA_API_KEY") ?? "" } : null
}

export async function redactarConModelo(pregunta: string, borrador: string, historial: Mensaje[]): Promise<string> {
  const modelo = proveedor()
  if (!modelo) throw new ErrorSolicitud("No hay un modelo de lenguaje configurado")

  const sistema =
    "Eres el asistente de un Product Owner. Responde en español, breve y concreto, usando SOLO los datos del borrador. " +
    "Puedes reorganizar y mejorar la redacción, pero no inventes datos ni digas que ejecutaste acciones.\n\n" +
    `BORRADOR CON DATOS:\n${borrador}`

  const respuesta = await fetch(`${modelo.base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(modelo.clave ? { Authorization: `Bearer ${modelo.clave}` } : {}),
    },
    body: JSON.stringify({
      model: modelo.modelo,
      temperature: 0.3,
      messages: [
        { role: "system", content: sistema },
        ...historial.slice(-MENSAJES_HISTORIAL),
        { role: "user", content: pregunta },
      ],
    }),
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  })
  if (!respuesta.ok) throw new Error(`El modelo respondió ${respuesta.status}`)
  const datos = await respuesta.json()
  return datos.choices[0].message.content as string
}
