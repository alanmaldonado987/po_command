const ZONA = "America/Bogota"
const DESFASE = "-05:00"
const MS_HORA = 3_600_000
const MS_DIA = 86_400_000

function partes(fecha: Date): Record<string, string> {
  const formato = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
  return Object.fromEntries(formato.formatToParts(fecha).map((parte) => [parte.type, parte.value]))
}

export function hoy(ahora = new Date()): string {
  const { year, month, day } = partes(ahora)
  return `${year}-${month}-${day}`
}

export function formatoLocal(iso: string): string {
  const { year, month, day, hour, minute } = partes(new Date(iso))
  return `${year}-${month}-${day} ${hour}:${minute}`
}

export function formatoFecha(iso: string | null | undefined): string {
  if (!iso) return "-"
  const [anio, mes, dia] = iso.slice(0, 10).split("-")
  return `${dia}/${mes}/${anio}`
}

export const esLunes = (ahora = new Date()): boolean => new Date(`${hoy(ahora)}T12:00:00Z`).getUTCDay() === 1

export function semanaIso(fechaIso: string): { anio: number; semana: number } {
  const fecha = new Date(`${fechaIso}T00:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() + 4 - (fecha.getUTCDay() || 7))
  const inicioAnio = Date.UTC(fecha.getUTCFullYear(), 0, 1)
  return { anio: fecha.getUTCFullYear(), semana: Math.ceil(((fecha.getTime() - inicioAnio) / MS_DIA + 1) / 7) }
}

export function aLaHora(hora: string, ahora = new Date()): Date {
  const objetivo = new Date(`${hoy(ahora)}T${hora || "00:00"}:00${DESFASE}`)
  return objetivo > ahora ? objetivo : ahora
}

export const inicioDelDia = (ahora = new Date()): Date => new Date(`${hoy(ahora)}T00:00:00${DESFASE}`)

export const sumarHoras =(fecha: Date, horas: number): Date => new Date(fecha.getTime() + horas * MS_HORA)

export function sumarDias(fechaIso: string, dias: number): string {
  const fecha = new Date(`${fechaIso}T00:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

export const horasEntre = (desde: Date, hasta: Date): number => Math.floor((hasta.getTime() - desde.getTime()) / MS_HORA)
