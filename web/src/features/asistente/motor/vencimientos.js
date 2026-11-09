import { itemsPorVencer } from '../../../lib/dominio'
import { formatoFecha, sumarDias } from '../../../lib/fechas'
import { DIAS_VENTANA } from './constantes'
import { contexto, lineaItem, respuesta } from './formato'

export function vencimientos(datos) {
  const { hoy } = contexto(datos)
  const tope = sumarDias(hoy, DIAS_VENTANA)
  const items = itemsPorVencer(datos.items, DIAS_VENTANA, hoy)
  const acuerdos = datos.acuerdos.filter((a) => a.estado !== 'Cumplido' && a.fecha_limite && a.fecha_limite <= tope)
  if (!items.length && !acuerdos.length) return respuesta('Nada vence en los próximos 7 días.')

  const lineas = [
    ...items.map(
      (i) =>
        `- ${i.fecha_compromiso < hoy ? '**Vencido** · ' : ''}${formatoFecha(i.fecha_compromiso)} · ${lineaItem(i, ` · ${i.estado}`)}`,
    ),
    ...acuerdos.map(
      (a) => `- ${formatoFecha(a.fecha_limite)} · Acuerdo: ${a.descripcion} (${a.responsable ?? 'sin responsable'})`,
    ),
  ]
  return respuesta(`**Vencido o por vencer en los próximos 7 días**\n\n${lineas.join('\n')}`)
}
