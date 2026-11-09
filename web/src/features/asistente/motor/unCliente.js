import { ESTADO_PRUEBAS } from '../../../lib/constantes'
import { estaAbierto } from '../../../lib/dominio'
import { normalizar } from '../../../lib/texto'
import { accionEscalar, lineaItem, porAtrasoDescendente, respuesta } from './formato'

const MAXIMO_ACCIONES = 2
const MAXIMO_LISTADOS = 5
const sinGuiones = (texto) => texto.replace(/-/g, '')

function resumenPorActividad(items) {
  const porActividad = {}
  items.forEach((item) => {
    const actividad = (porActividad[item.actividad ?? 'Sin actividad'] ??= { total: 0, terminados: 0, pruebas: 0, atrasados: 0 })
    actividad.total += 1
    actividad.terminados += item.estado === 'Terminado' ? 1 : 0
    actividad.pruebas += item.estado === ESTADO_PRUEBAS ? 1 : 0
    actividad.atrasados += estaAbierto(item) && item.atraso_dias > 0 ? 1 : 0
  })
  return Object.entries(porActividad)
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(
      ([nombre, v]) =>
        `- **${nombre}**: ${v.terminados} de ${v.total} terminados, ${v.pruebas} en pruebas${v.atrasados ? `, **${v.atrasados} atrasados**` : ''}`,
    )
}

export function unCliente(pregunta, datos) {
  const consulta = sinGuiones(normalizar(pregunta))
  const cliente = datos.clientes.find((c) => consulta.includes(sinGuiones(normalizar(c.nombre))))
  if (!cliente) return null

  const items = datos.items.filter((i) => i.cliente_id === cliente.id)
  if (!items.length) return respuesta(`${cliente.nombre} no tiene ítems en el backlog.`)

  const atrasados = items.filter((i) => estaAbierto(i) && i.atraso_dias > 0).sort(porAtrasoDescendente)
  const bloqueos = datos.bloqueantes.filter((b) => b.cliente_id === cliente.id)
  const terminados = items.filter((i) => i.estado === 'Terminado').length

  let texto = `**${cliente.nombre}** · ${terminados} de ${items.length} ítems terminados (${Math.round((terminados / items.length) * 100)}%)\n\n${resumenPorActividad(items).join('\n')}`
  if (atrasados.length) {
    const lineas = atrasados.slice(0, MAXIMO_LISTADOS).map((i) => `- ${lineaItem(i, ` · ${i.atraso_dias} días`)}`)
    texto += `\n\n**Más atrasados:**\n${lineas.join('\n')}`
  }
  if (bloqueos.length) texto += `\n\n**Bloqueos:** ${bloqueos.map((b) => `${b.codigo}: ${b.motivo}`).join('; ')}`

  return respuesta(
    texto,
    bloqueos.slice(0, MAXIMO_ACCIONES).map((b) => accionEscalar(b, `Escalar ${b.codigo}`)),
  )
}
