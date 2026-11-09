import { formatoFecha } from '../../../lib/fechas'
import { normalizar } from '../../../lib/texto'
import { accionEscalar, contexto, horasAbierto, respuesta } from './formato'

export async function escalamiento(pregunta, datos) {
  if (!datos.bloqueantes.length) return respuesta('No hay bloqueos abiertos para escalar.')
  const { ahora } = contexto(datos)

  const codigo = normalizar(pregunta).match(/bl-?\s?(\d+)/)
  const bloqueante =
    datos.bloqueantes.find((b) => codigo && Number(b.codigo.slice(3)) === Number(codigo[1])) ?? datos.bloqueantes[0]
  const item = datos.items.find((i) => i.id === bloqueante.item_id)
  const destinatarios = await datos.resolverDestinatarios({ regla_codigo: 'BLOQUEO_ESCALAR', item_id: bloqueante.item_id })
  const horas = horasAbierto(bloqueante.abierto_en, ahora)
  const para = destinatarios.map((d) => `${d.nombre} <${d.correo}>`).join(', ') || 'nadie con correo válido'
  const antesDe = item.fecha_compromiso ? ` antes de la fecha fin planificada (${formatoFecha(item.fecha_compromiso)})` : ''

  const texto = [
    `**Borrador de escalamiento para ${bloqueante.codigo}**`,
    `**Para:** ${para}`,
    `**Asunto:** [Escalamiento] ${bloqueante.codigo} ${item.cliente ?? ''} · ${item.titulo} · bloqueado ${horas} h`,
    `Hola,\n\nEl ítem **${bloqueante.codigo} ${item.titulo}** (${item.cliente ?? '-'} · ${item.actividad ?? '-'} · ${item.modulo ?? '-'}, ` +
      `${item.alcance || '-'}) lleva ${horas} horas bloqueado. Motivo: *${bloqueante.motivo}*. Responsable: ${item.responsable ?? 'sin asignar'}.\n\n` +
      `Necesitamos su apoyo para destrabarlo${antesDe}. ¿Pueden confirmar responsable y fecha de solución respondiendo este correo?\n\nGracias,\n${datos.po?.nombre ?? 'Product Owner'}`,
  ].join('\n\n')

  return respuesta(texto, [accionEscalar(bloqueante, `Enviar este escalamiento (${destinatarios.length} destinatario/s)`)])
}
