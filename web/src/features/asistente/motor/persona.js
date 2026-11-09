import { estaAbierto } from '../../../lib/dominio'
import { normalizar } from '../../../lib/texto'
import { lineaItem, respuesta } from './formato'

const LARGO_MINIMO_NOMBRE = 3

function detalle(item) {
  const bloqueo = item.bloqueado ? ' · BLOQUEADO' : ''
  const atraso = item.atraso_dias ? ` · ${item.atraso_dias} días de atraso` : ''
  return lineaItem(item, ` · ${item.estado}${bloqueo}${atraso}`)
}

export function persona(pregunta, datos) {
  const consulta = normalizar(pregunta)
  const encontrada = datos.personas.find((p) =>
    normalizar(p.nombre)
      .split(' ')
      .some((parte) => parte.length > LARGO_MINIMO_NOMBRE && consulta.includes(parte)),
  )
  if (!encontrada) return null

  const items = datos.items.filter((i) => i.responsable_id === encontrada.id && estaAbierto(i))
  const cuerpo = items.map((i) => `- ${detalle(i)}`).join('\n') || 'No tiene ítems abiertos.'
  return respuesta(
    `**${encontrada.nombre}** (${encontrada.rol || encontrada.tipo}, ${encontrada.correo || 'sin correo'}) · ${items.length} ítem(s) abiertos\n\n${cuerpo}`,
  )
}
