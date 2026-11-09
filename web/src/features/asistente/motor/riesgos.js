import { itemsPorVencer } from '../../../lib/dominio'
import { formatoFecha } from '../../../lib/fechas'
import { DIAS_VENTANA } from './constantes'
import { abiertos, accionEscalar, accionRecordar, contexto, horasAbierto, porAtrasoDescendente, respuesta } from './formato'

const MAXIMO_ACCIONES = 4
const HORAS_PARA_ESCALAR = 24

function riesgosDeBloqueo(datos, ahora) {
  const lineas = []
  const acciones = []
  datos.bloqueantes.forEach((bloqueante) => {
    const horas = horasAbierto(bloqueante.abierto_en, ahora)
    lineas.push(
      `- **[Alto] ${bloqueante.codigo} bloqueado hace ${horas} h** (${bloqueante.cliente ?? '-'} · ${bloqueante.titulo}): ${bloqueante.motivo}.`,
    )
    if (horas > HORAS_PARA_ESCALAR) acciones.push(accionEscalar(bloqueante, `Enviar escalamiento de ${bloqueante.codigo}`))
  })
  return { lineas, acciones }
}

export function riesgos(datos) {
  const { hoy, ahora } = contexto(datos)
  const { lineas, acciones } = riesgosDeBloqueo(datos, ahora)
  const abiertosPlan = abiertos(datos)

  const atrasados = abiertosPlan.filter((i) => i.atraso_dias > 0).sort(porAtrasoDescendente)
  if (atrasados.length) {
    const peores = atrasados
      .slice(0, 5)
      .map((i) => `${i.codigo} ${i.cliente} · ${i.titulo} (${i.atraso_dias} días)`)
      .join('; ')
    lineas.push(`- **[Alto] ${atrasados.length} ítem(s) pasaron su fecha fin planificada.** Los de más atraso: ${peores}.`)
  }

  const proximos = itemsPorVencer(datos.items, DIAS_VENTANA, hoy).filter((i) => i.atraso_dias === 0)
  if (proximos.length) {
    const detalle = proximos
      .slice(0, 8)
      .map((i) => `${i.codigo} (${formatoFecha(i.fecha_compromiso)})`)
      .join(', ')
    lineas.push(`- **[Medio] ${proximos.length} ítem(s) vencen en los próximos 7 días**: ${detalle}.`)
  }

  const sinResponsable = abiertosPlan.filter((i) => !i.responsable_id)
  if (sinResponsable.length) {
    lineas.push(
      `- **[Medio] ${sinResponsable.length} ítem(s) abiertos sin responsable**: ${sinResponsable.slice(0, 8).map((i) => i.codigo).join(', ')}.`,
    )
  }

  const sinFecha = abiertosPlan.filter((i) => !i.fecha_compromiso && i.estado === 'En curso')
  if (sinFecha.length) {
    lineas.push(
      `- **[Bajo] ${sinFecha.length} ítem(s) en curso sin fecha fin planificada**: ${sinFecha.slice(0, 8).map((i) => i.codigo).join(', ')}.`,
    )
  }

  if (!lineas.length) lineas.push('- No veo riesgos: no hay bloqueos, atrasos ni vencimientos en los próximos 7 días.')
  if (atrasados.length) {
    acciones.push(
      accionRecordar(atrasados, `Enviar recordatorio a los responsables de los ${atrasados.length} atrasados (un correo por persona)`),
    )
  }
  return respuesta(`**Riesgos del plan de trabajo**\n\n${lineas.join('\n')}`, acciones.slice(0, MAXIMO_ACCIONES))
}
