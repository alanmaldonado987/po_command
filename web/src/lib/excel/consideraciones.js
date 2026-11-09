import { aIsoFecha } from '../fechas'
import { clave } from './normalizar'

const MESES = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12, dec: 12,
}

function diaYMes(texto) {
  const diaPrimero = texto.match(/^(\d{1,2})\s*([a-z]{3,4})\b/)
  if (diaPrimero && MESES[diaPrimero[2]]) return [Number(diaPrimero[1]), MESES[diaPrimero[2]]]
  const mesPrimero = texto.match(/^([a-z]{3,4})\.?\s*(\d{1,2})\b/)
  if (mesPrimero && MESES[mesPrimero[1]]) return [Number(mesPrimero[2]), MESES[mesPrimero[1]]]
  return null
}

export function fechaDeNota(texto, anio) {
  const partes = diaYMes(clave(texto))
  if (!partes) return null
  const [dia, mes] = partes
  const fecha = new Date(anio, mes - 1, dia)
  return fecha.getMonth() === mes - 1 && fecha.getDate() === dia ? aIsoFecha(fecha) : null
}

export function partirConsideraciones(texto) {
  const lineas = String(texto ?? '')
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
  return lineas.reduce((notas, linea) => {
    if (notas.length && !fechaDeNota(linea, 2026)) notas[notas.length - 1] += ` ${linea}`
    else notas.push(linea)
    return notas
  }, [])
}
