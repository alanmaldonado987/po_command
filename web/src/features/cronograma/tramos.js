import { estadoVisible, etiquetaItem } from '../../lib/dominio'
import { formatoFecha, sumarDias } from '../../lib/fechas'

export const TRAMOS = [
  { campoInicio: 'plan_ini', campoFin: 'plan_fin', nombre: 'Desarrollo / customización · planificado', color: '#BAE6FD', ejecutado: false },
  { campoInicio: 'plan_pruebas_ini', campoFin: 'plan_pruebas_fin', nombre: 'Ajustes (pruebas) · planificado', color: '#FDE68A', ejecutado: false },
  { campoInicio: 'real_ini', campoFin: 'real_fin', nombre: 'Desarrollo / customización · ejecutado', color: '#0369A1', ejecutado: true },
  { campoInicio: 'real_pruebas_ini', campoFin: 'real_pruebas_fin', nombre: 'Ajustes (pruebas) · ejecutado', color: '#D97706', ejecutado: true },
]

export const LEYENDA_TRAMOS = TRAMOS.map(({ nombre, color }) => ({ nombre, color }))

function tramosDelItem(item) {
  return TRAMOS.filter(({ campoInicio, campoFin }) => item[campoInicio] || item[campoFin]).map((tramo) => {
    const inicio = item[tramo.campoInicio] || item[tramo.campoFin]
    const fin = item[tramo.campoFin] || item[tramo.campoInicio]
    return { clave: tramo.campoInicio, inicio, fin: sumarDias(fin, 1), color: tramo.color, ejecutado: tramo.ejecutado }
  })
}

function detalleDelItem(item) {
  return [
    etiquetaItem(item),
    `Estado: ${estadoVisible(item)}`,
    `Responsable: ${item.responsable ?? '-'}`,
    `Atraso: ${item.atraso_dias} día(s)`,
    `Fin planificado: ${formatoFecha(item.fecha_compromiso)}`,
  ].join('\n')
}

export function construirFilasGantt(items) {
  const filas = items
    .map((item) => ({ id: item.id, etiqueta: etiquetaItem(item), detalle: detalleDelItem(item), tramos: tramosDelItem(item) }))
    .filter((fila) => fila.tramos.length > 0)
  return filas.sort((a, b) => minimoInicio(a).localeCompare(minimoInicio(b)))
}

export const itemsSinFechas = (items) => items.filter((item) => tramosDelItem(item).length === 0)

const minimoInicio = (fila) => fila.tramos.map((tramo) => tramo.inicio).sort()[0]
