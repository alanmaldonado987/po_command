import { valorConfig } from "./configuracion.ts"
import type { Fila } from "./tipos.ts"

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }

export const escaparHtml = (texto: string): string => texto.replace(/[&<>"']/g, (caracter) => ESCAPES[caracter])

interface DatosPlantilla {
  titulo: string
  saludo: string
  intro: string
  filas: Fila[]
  cierre?: string
  color?: string
}

export async function plantilla({ titulo, saludo, intro, filas, cierre = "", color = "#0369A1" }: DatosPlantilla): Promise<string> {
  const url = await valorConfig("app_url", "http://localhost:5173")
  const tabla = filas
    .map(
      ([clave, valor]) =>
        `<tr><td style='padding:6px 12px 6px 0;color:#475569;font-size:13px;vertical-align:top'>${escaparHtml(clave)}</td>` +
        `<td style='padding:6px 0;color:#0F172A;font-size:13px'>${escaparHtml(valor)}</td></tr>`,
    )
    .join("")
  const parrafoCierre = cierre ? `<p style="margin:14px 0 0;line-height:1.5">${escaparHtml(cierre)}</p>` : ""

  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:auto;color:#334155">
  <div style="background:#0F172A;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">
    <div style="font-size:11px;letter-spacing:.08em;color:#7DD3FC;font-weight:700">PO COMMAND CENTER</div>
    <div style="font-size:19px;font-weight:700;margin-top:4px">${escaparHtml(titulo)}</div>
  </div>
  <div style="border:1px solid #E2E8F0;border-top:4px solid ${color};padding:20px 22px;border-radius:0 0 10px 10px">
    <p style="margin:0 0 10px">${escaparHtml(saludo)}</p>
    <p style="margin:0 0 14px;line-height:1.5">${escaparHtml(intro)}</p>
    <table style="border-collapse:collapse;background:#F8FAFC;border-radius:8px;padding:8px;width:100%">${tabla}</table>
    ${parrafoCierre}
    <p style="margin:18px 0 0"><a href="${escaparHtml(url)}" style="background:${color};color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">Abrir PO Command</a></p>
  </div>
</div>`
}
