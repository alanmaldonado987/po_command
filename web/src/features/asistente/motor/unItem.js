import { formatoFecha } from '../../../lib/fechas'
import { normalizar } from '../../../lib/texto'
import { accionEscalar, respuesta } from './formato'

const MAXIMO_NOTAS = 3

const porRecientes = (a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id

export function unItem(pregunta, datos) {
  const coincidencia = normalizar(pregunta).match(/bl-?\s?(\d+)/)
  if (!coincidencia) return null

  const codigo = `BL-${String(Number(coincidencia[1])).padStart(3, '0')}`
  const item = datos.items.find((i) => i.codigo.toLowerCase() === codigo.toLowerCase())
  if (!item) return respuesta(`No encontré el ítem ${codigo}.`)

  const notas = datos.notas.filter((n) => n.item_id === item.id).sort(porRecientes).slice(0, MAXIMO_NOTAS)
  const rango = (inicio, fin) => `${formatoFecha(inicio)} → ${formatoFecha(fin)}`
  const lineas = [
    `**${item.codigo} ${item.titulo}**\n`,
    `- ${item.producto ?? '-'} · ${item.cliente ?? '-'} · ${item.actividad ?? '-'} · ${item.modulo ?? '-'}`,
    `- Fase ${item.fase || '-'} · alcance ${item.alcance || '-'} · responsable ${item.responsable ?? 'sin asignar'}`,
    `- Estado: **${item.estado}**${item.atraso_dias ? ` · **${item.atraso_dias} días de atraso**` : ''}`,
    `- Planificado: desarrollo ${rango(item.plan_ini, item.plan_fin)}, pruebas ${rango(item.plan_pruebas_ini, item.plan_pruebas_fin)}`,
    `- Ejecutado: desarrollo ${rango(item.real_ini, item.real_fin)}, pruebas ${rango(item.real_pruebas_ini, item.real_pruebas_fin)}`,
  ]
  if (item.bloqueado) lineas.push(`- **Bloqueado:** ${item.motivo_bloqueo}`)
  let texto = lineas.join('\n')
  if (notas.length) {
    texto += `\n\n**Últimas notas:**\n${notas.map((n) => `- ${formatoFecha(n.fecha)} (${n.tipo}): ${n.texto}`).join('\n')}`
  }

  const acciones = datos.bloqueantes
    .filter((b) => b.item_id === item.id)
    .map((b) => accionEscalar(b, `Escalar el bloqueo de ${item.codigo}`))
  return respuesta(texto, acciones)
}
