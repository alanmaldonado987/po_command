const ZONA = 'America/Bogota'
const MS_DIA = 86_400_000

const formatoFecha = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA })

export const hoyIso = () => formatoFecha.format(new Date())

export const sumarDias = (iso, dias) => {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

export const diasEntre = (inicio, fin) => Math.round((Date.parse(fin) - Date.parse(inicio)) / MS_DIA)

export const haceDias = (dias) => sumarDias(hoyIso(), -dias)
export const enDias = (dias) => sumarDias(hoyIso(), dias)

export const ahoraIso = (desplazamientoHoras = 0) => new Date(Date.now() + desplazamientoHoras * 3_600_000).toISOString()

export const formatoLatino = (iso) => {
  if (!iso) return '-'
  const [anio, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${anio}`
}
