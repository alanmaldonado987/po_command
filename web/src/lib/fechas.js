const MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MS_DIA = 86_400_000

const dosDigitos = (n) => String(n).padStart(2, '0')

export const mesCorto = (fecha) => MESES_CORTOS[fecha.getMonth()]
export const diaSemana = (fecha) => DIAS_SEMANA[fecha.getDay()]

export function aIsoFecha(fecha) {
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`
}

export const hoyIso = () => aIsoFecha(new Date())

export function desdeIsoFecha(iso) {
  if (!iso) return null
  const [anio, mes, dia] = iso.slice(0, 10).split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

export function formatoFecha(iso) {
  if (!iso) return '-'
  const [anio, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${anio}`
}

export function formatoFechaHora(iso) {
  if (!iso) return '-'
  const fecha = new Date(iso)
  return `${dosDigitos(fecha.getDate())}/${dosDigitos(fecha.getMonth() + 1)} ${formatoHora(fecha)}`
}

export function formatoHora(fecha) {
  return `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`
}

export function sumarDias(iso, dias) {
  const fecha = desdeIsoFecha(iso)
  fecha.setDate(fecha.getDate() + dias)
  return aIsoFecha(fecha)
}

export function diasEntre(inicioIso, finIso) {
  return Math.round((desdeIsoFecha(finIso) - desdeIsoFecha(inicioIso)) / MS_DIA)
}

export function horasDesde(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
}

export function aInputDateTime(iso) {
  const fecha = new Date(iso)
  return { fecha: aIsoFecha(fecha), hora: formatoHora(fecha) }
}

export function desdeInputDateTime(fecha, hora) {
  return new Date(`${fecha}T${hora}`).toISOString()
}
