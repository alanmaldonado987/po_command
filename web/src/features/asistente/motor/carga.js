import { cargaPorResponsable } from '../../../lib/dominio'
import { abiertos, respuesta } from './formato'

export function cargaEquipo(datos) {
  const carga = cargaPorResponsable(datos.items)
  const clientesPorPersona = {}
  abiertos(datos).forEach((item) => {
    const nombre = item.responsable ?? 'Sin responsable'
    ;(clientesPorPersona[nombre] ??= new Set()).add(item.cliente ?? '-')
  })
  const entradas = Object.entries(carga).map(([nombre, valor]) => [nombre === 'Sin asignar' ? 'Sin responsable' : nombre, valor])
  if (!entradas.length) return respuesta('No hay ítems abiertos.')

  const lineas = entradas
    .sort((a, b) => b[1].abiertos - a[1].abiertos)
    .map(([nombre, { abiertos: n, atrasados }]) => {
      const clientes = [...(clientesPorPersona[nombre] ?? [])].sort().join(', ')
      return `- **${nombre}**: ${n} abiertos${atrasados ? `, **${atrasados} atrasados**` : ''} · ${clientes}`
    })
  const conCarga = new Set(entradas.map(([nombre]) => nombre))
  const libres = datos.personas
    .filter((p) => p.tipo === 'equipo' && p.activo && !conCarga.has(p.nombre))
    .map((p) => p.nombre)
    .sort()
  const sufijo = libres.length ? `\n\nSin ítems abiertos: ${libres.join(', ')}.` : ''
  return respuesta(`**Carga del equipo (ítems abiertos)**\n\n${lineas.join('\n')}${sufijo}`)
}
