import { formatoFecha } from '../../../lib/fechas'
import { abiertos, accionRecordar, lineaItem, respuesta } from './formato'

const porClienteYAtraso = (a, b) =>
  (a.cliente ?? '').localeCompare(b.cliente ?? '', 'es') || b.atraso_dias - a.atraso_dias

export function atrasados(datos) {
  const lista = abiertos(datos).filter((i) => i.atraso_dias > 0).sort(porClienteYAtraso)
  if (!lista.length) return respuesta('No hay ítems atrasados frente a su fecha fin planificada.')

  const lineas = []
  let actual = null
  lista.forEach((item) => {
    if (item.cliente !== actual) {
      actual = item.cliente
      lineas.push(`\n**${actual ?? 'Sin cliente'}**`)
    }
    const extra = ` · fin plan. ${formatoFecha(item.fecha_compromiso)} · **${item.atraso_dias} días**`
    lineas.push(`- ${lineaItem(item, extra)}`)
  })
  return respuesta(`**${lista.length} ítem(s) atrasados**${lineas.join('\n')}`, [
    accionRecordar(lista, `Enviar recordatorio a los responsables (${lista.length})`),
  ])
}
