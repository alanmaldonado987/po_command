import * as XLSX from 'xlsx'
import { ALCANCES, CAMPOS_FECHA, FASES } from '../constantes'
import { aIsoFecha } from '../fechas'
import { limpiar } from '../texto'
import { fechaDeNota, partirConsideraciones } from './consideraciones'
import { clave, normalizarCampo } from './normalizar'

const CAMPOS_FECHA_ORDEN = Object.keys(CAMPOS_FECHA)
const MEDIO_DIA_MS = 12 * 3_600_000
const FILAS_ENCABEZADO = 7
const ANIO_POR_DEFECTO = 2026

const aFechaIso = (valor) => {
  if (valor instanceof Date) return aIsoFecha(new Date(valor.getTime() + MEDIO_DIA_MS))
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor.trim())) return valor.trim().slice(0, 10)
  return null
}

function leerCeldas(hoja) {
  const rango = XLSX.utils.decode_range(hoja['!ref'] ?? 'A1')
  const valores = new Map()
  const guardar = (fila, columna, valor) => valores.set(`${fila}:${columna}`, valor)
  for (let fila = rango.s.r; fila <= rango.e.r; fila += 1) {
    for (let columna = rango.s.c; columna <= rango.e.c; columna += 1) {
      const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: columna })]
      if (celda) guardar(fila + 1, columna, celda.v)
    }
  }
  ;(hoja['!merges'] ?? []).forEach(({ s, e }) => {
    const valor = valores.get(`${s.r + 1}:${s.c}`)
    for (let fila = s.r; fila <= e.r; fila += 1) {
      for (let columna = s.c; columna <= e.c; columna += 1) guardar(fila + 1, columna, valor)
    }
  })
  return { filas: rango.e.r + 1, columnas: rango.e.c + 1, celda: (fila, columna) => valores.get(`${fila}:${columna}`) }
}

const CAMPOS_TEXTO = {
  cliente: (k) => k === 'cliente',
  actividad: (k) => k === 'actividad',
  funcionalidad: (k) => k.startsWith('menu'),
  modulo: (k) => k.startsWith('modulo'),
  fase: (k) => k === 'fase',
  alcance: (k) => k === 'alcance',
  responsable: (k) => k === 'responsable',
  estado: (k) => k === 'estado',
  producto: (k) => k === 'producto',
}

function ubicarColumnas(encabezados) {
  const columnas = {}
  const fechas = []
  const consideraciones = []
  encabezados.forEach((encabezado, indice) => {
    const texto = clave(encabezado)
    const campo = Object.entries(CAMPOS_TEXTO).find(([, coincide]) => coincide(texto))
    if (campo) columnas[campo[0]] = indice
    else if (texto.startsWith('fecha')) fechas.push(indice)
    else if (texto.startsWith('consideracion')) consideraciones.push(indice)
  })
  const completas = columnas.cliente !== undefined && columnas.funcionalidad !== undefined && columnas.modulo !== undefined
  if (!completas || fechas.length < CAMPOS_FECHA_ORDEN.length) return null
  CAMPOS_FECHA_ORDEN.forEach((campo, i) => {
    columnas[campo] = fechas[i]
  })
  columnas.consid_plan = consideraciones[0]
  columnas.consid_real = consideraciones[1]
  return columnas
}

function leerFila(hoja, fila, columnas, faseHoja, avisos) {
  const dato = (campo) => (columnas[campo] === undefined ? undefined : hoja.celda(fila, columnas[campo]))
  const funcionalidad = normalizarCampo('funcionalidad', dato('funcionalidad'))
  const modulo = normalizarCampo('modulo', dato('modulo'))
  if (!funcionalidad && !modulo) return null

  const registro = {
    hoja: hoja.titulo,
    fila,
    cliente: normalizarCampo('cliente', dato('cliente') || hoja.titulo),
    actividad: normalizarCampo('actividad', dato('actividad')),
    funcionalidad: funcionalidad || 'Completo',
    modulo,
    fase: normalizarCampo('fase', dato('fase')) || faseHoja,
    alcance: normalizarCampo('alcance', dato('alcance')),
    responsable: normalizarCampo('persona', dato('responsable')),
    estado: normalizarCampo('estado', dato('estado')),
    producto: limpiar(dato('producto')),
  }
  CAMPOS_FECHA_ORDEN.forEach((campo) => {
    registro[campo] = aFechaIso(dato(campo))
  })
  const anio = Number((registro.plan_ini ?? String(ANIO_POR_DEFECTO)).slice(0, 4))
  const aNotas = (texto) =>
    partirConsideraciones(texto).map((nota) => ({ texto: nota, fecha: fechaDeNota(nota, anio) }))
  registro.consid_plan = aNotas(dato('consid_plan'))
  registro.consid_real = aNotas(dato('consid_real'))

  if (registro.fase && !FASES.includes(registro.fase)) {
    avisos.push(`${hoja.titulo} fila ${fila}: fase «${registro.fase}» no es Desarrollo ni Customización; se dejó como está.`)
  }
  if (registro.alcance && !ALCANCES.includes(registro.alcance)) {
    avisos.push(`${hoja.titulo} fila ${fila}: alcance «${registro.alcance}» no está en la lista; se dejó como está.`)
  }
  if (!registro.estado) {
    registro.estado = registro.real_ini || registro.real_pruebas_ini ? 'En curso' : 'No iniciado'
    registro.estado_deducido = true
  }
  return registro
}

function leerHoja(nombre, hojaXlsx, avisos) {
  const hoja = { ...leerCeldas(hojaXlsx), titulo: nombre }
  let filaEncabezado = null
  for (let fila = 1; fila <= FILAS_ENCABEZADO && !filaEncabezado; fila += 1) {
    if (clave(hoja.celda(fila, 0)) === 'cliente') filaEncabezado = fila
  }
  if (!filaEncabezado) {
    avisos.push(`Hoja «${nombre}»: no encontré la fila de encabezados (Cliente, Actividad…); se omitió.`)
    return []
  }
  const encabezados = Array.from({ length: hoja.columnas }, (_, columna) => hoja.celda(filaEncabezado, columna))
  const columnas = ubicarColumnas(encabezados)
  if (!columnas) {
    avisos.push(`Hoja «${nombre}»: faltan columnas obligatorias; se omitió.`)
    return []
  }
  const textoFase = String(hoja.celda(filaEncabezado - 1, columnas.plan_ini) ?? '').replace(/\(.*?\)/g, '')
  const faseHoja = normalizarCampo('fase', textoFase)
  const registros = []
  for (let fila = filaEncabezado + 1; fila <= hoja.filas; fila += 1) {
    const registro = leerFila(hoja, fila, columnas, faseHoja, avisos)
    if (registro) registros.push(registro)
  }
  return registros
}

export function leerPlan(datos) {
  const libro = XLSX.read(datos, { type: 'array', cellDates: true })
  const avisos = []
  const filas = libro.SheetNames.flatMap((nombre) => leerHoja(nombre, libro.Sheets[nombre], avisos))
  return { filas, avisos }
}
