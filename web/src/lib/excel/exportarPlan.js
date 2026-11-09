import * as XLSX from 'xlsx'
import { agrupar } from '../texto'

const ENCABEZADOS = [
  'Cliente', 'Actividad', 'Menú/Funcionalidad', 'Modulo/Componente', 'Fase', 'Alcance', 'Responsable',
  'Fecha inicio', 'Fecha Fin', 'Fecha inicio', 'Fecha Fin', 'Consideraciones',
  'Fecha inicio', 'Fecha Fin', 'Fecha inicio', 'Fecha Fin', 'Consideraciones', 'Estado', 'Código', 'Producto',
]
const ANCHOS = [14, 20, 34, 28, 14, 14, 22, 12, 12, 12, 12, 40, 12, 12, 12, 12, 40, 26, 9, 14]
const COMBINADAS = [
  [0, 7, 0, 11],
  [0, 12, 0, 16],
  [1, 7, 1, 8],
  [1, 9, 1, 10],
  [1, 12, 1, 13],
  [1, 14, 1, 15],
]
const TIPOS_PLANIFICACION = ['Planificación', 'Reprogramación']
const TIPOS_EJECUCION = ['Ejecución', 'Seguimiento', 'Bloqueo']
const FORMATO_FECHA = 'dd/mm/yyyy'
const MS_DIA = 86_400_000
const EPOCA_EXCEL = Date.UTC(1899, 11, 30)

const celdaFecha = (iso) => {
  if (!iso) return null
  const [anio, mes, dia] = iso.slice(0, 10).split('-').map(Number)
  return { t: 'n', v: (Date.UTC(anio, mes - 1, dia) - EPOCA_EXCEL) / MS_DIA, z: FORMATO_FECHA }
}

const nombreHoja = (cliente, usados) => {
  const base = cliente.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31).trim() || 'Plan'
  let nombre = base
  for (let n = 2; usados.has(nombre.toLowerCase()); n += 1) nombre = `${base.slice(0, 28)} ${n}`
  usados.add(nombre.toLowerCase())
  return nombre
}

function textoNotas(notas, tipos) {
  return notas
    .filter((nota) => tipos.includes(nota.tipo))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id)
    .map((nota) => nota.texto)
    .join('\n')
}

function filaItem(item, notas) {
  return [
    item.cliente ?? 'Sin cliente', item.actividad, item.funcionalidad, item.modulo, item.fase, item.alcance, item.responsable,
    celdaFecha(item.plan_ini), celdaFecha(item.plan_fin), celdaFecha(item.plan_pruebas_ini), celdaFecha(item.plan_pruebas_fin),
    textoNotas(notas, TIPOS_PLANIFICACION),
    celdaFecha(item.real_ini), celdaFecha(item.real_fin), celdaFecha(item.real_pruebas_ini), celdaFecha(item.real_pruebas_fin),
    textoNotas(notas, TIPOS_EJECUCION),
    item.estado, item.codigo, item.producto,
  ]
}

function construirHoja(cliente, items, notasPorItem) {
  const cabecera = Array(ENCABEZADOS.length).fill(null)
  const titulos = [...cabecera]
  titulos[0] = cliente
  titulos[7] = 'PLANIFICACIÓN'
  titulos[12] = 'EJECUCIÓN'
  const tramos = [...cabecera]
  Object.assign(tramos, { 7: 'Desarrollo / Customización', 9: 'Ajustes (Pruebas)', 12: 'Desarrollo / Customización', 14: 'Ajustes (Pruebas)' })
  const hoja = XLSX.utils.aoa_to_sheet([titulos, tramos, ENCABEZADOS, ...items.map((i) => filaItem(i, notasPorItem[i.id] ?? []))])
  hoja['!merges'] = COMBINADAS.map(([r1, c1, r2, c2]) => ({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } }))
  hoja['!cols'] = ANCHOS.map((wch) => ({ wch }))
  return hoja
}

export function exportarPlan(items, notas) {
  const notasPorItem = agrupar(notas, (nota) => nota.item_id)
  const porCliente = agrupar(items, (item) => item.cliente ?? 'Sin cliente')
  const libro = XLSX.utils.book_new()
  const usados = new Set()
  const clientes = Object.keys(porCliente).sort((a, b) => a.localeCompare(b, 'es'))
  clientes.forEach((cliente) => {
    XLSX.utils.book_append_sheet(libro, construirHoja(cliente, porCliente[cliente], notasPorItem), nombreHoja(cliente, usados))
  })
  if (!clientes.length) XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([]), 'Plan')
  return libro
}
