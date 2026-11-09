import { formatoFecha, sumarDias } from '../../../lib/fechas'
import { DIAS_VENTANA } from './constantes'
import { contexto, respuesta } from './formato'

const PREFIJO = 'Cambio de fechas · '

export function reprogramaciones(datos) {
  const { hoy } = contexto(datos)
  const desde = sumarDias(hoy, -DIAS_VENTANA)
  const notas = datos.notas
    .filter((n) => n.tipo === 'Reprogramación' && n.fecha >= desde)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
  if (!notas.length) return respuesta('No hubo cambios de fechas planificadas en los últimos 7 días.')

  const lineas = notas.flatMap((nota) => {
    const item = datos.items.find((i) => i.id === nota.item_id)
    if (!item) return []
    return [`- ${formatoFecha(nota.fecha)} · **${item.codigo}** ${item.cliente ?? '-'} · ${item.titulo}: ${nota.texto.replace(PREFIJO, '')}`]
  })
  return respuesta(`**${lineas.length} reprogramación(es) en los últimos 7 días**\n\n${lineas.join('\n')}`)
}
