import { avancePorCliente } from '../../../lib/dominio'
import { formatoFechaHora, sumarDias } from '../../../lib/fechas'
import { DIAS_VENTANA } from './constantes'
import { abiertos, contexto, respuesta } from './formato'

const MAXIMO_HITOS = 3
const MAXIMO_LISTADOS = 8
const MAXIMO_BLOQUEOS = 3

export async function resumen(datos) {
  const { hoy, ahora } = contexto(datos)
  const desde = sumarDias(hoy, -DIAS_VENTANA)
  const terminados = datos.items.filter((i) => i.terminado_en && i.terminado_en >= desde)
  const atrasados = abiertos(datos).filter((i) => i.atraso_dias > 0)
  const proximos = datos.ceremonias.filter((c) => new Date(c.fecha_hora).getTime() >= ahora).slice(0, MAXIMO_HITOS)
  const destinatarios = await datos.resolverDestinatarios({ regla_codigo: 'RESUMEN_SEMANAL' })

  const avance = avancePorCliente(datos.items)
    .map(
      (a) =>
        `  - ${a.cliente}: ${a.terminados} terminados, ${a.pruebas} en pruebas, ${a.enCurso} en curso, ${a.noIniciados} sin iniciar (de ${a.total})`,
    )
    .join('\n')
  const codigos = terminados.length ? `: ${terminados.slice(0, MAXIMO_LISTADOS).map((i) => i.codigo).join(', ')}` : ''
  const bloqueos = datos.bloqueantes.length
    ? `; ${datos.bloqueantes.slice(0, MAXIMO_BLOQUEOS).map((b) => `${b.codigo}: ${b.motivo}`).join('; ')}`
    : ''
  const hitos = proximos.map((c) => `${c.titulo} (${formatoFechaHora(c.fecha_hora)})`).join('; ') || 'sin ceremonias agendadas'

  const texto = [
    '**Resumen semanal del plan de trabajo**\n',
    `- **Avance por cliente:**\n${avance}`,
    `- **Terminados en 7 días:** ${terminados.length}${codigos}.`,
    `- **Atrasados:** ${atrasados.length}.`,
    `- **Bloqueos abiertos:** ${datos.bloqueantes.length}${bloqueos}.`,
    `- **Próximos hitos:** ${hitos}.`,
  ].join('\n')

  return respuesta(texto, [{ tipo: 'resumen', etiqueta: `Enviar el resumen ahora (${destinatarios.length} destinatario/s)` }])
}
