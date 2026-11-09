import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  aInputDateTime,
  aIsoFecha,
  desdeInputDateTime,
  desdeIsoFecha,
  diaSemana,
  diasEntre,
  formatoFecha,
  formatoFechaHora,
  formatoHora,
  horasDesde,
  hoyIso,
  mesCorto,
  sumarDias,
} from './fechas'

afterEach(() => vi.useRealTimers())

describe('formato de fechas', () => {
  it('formatea ISO como dd/mm/aaaa', () => {
    expect(formatoFecha('2026-03-05')).toBe('05/03/2026')
  })

  it('ignora la parte horaria de un timestamp', () => {
    expect(formatoFecha('2026-03-05T23:59:00Z')).toBe('05/03/2026')
  })

  it('muestra guion cuando no hay fecha', () => {
    expect(formatoFecha(null)).toBe('-')
    expect(formatoFecha('')).toBe('-')
  })

  it('formatea hora con ceros a la izquierda', () => {
    expect(formatoHora(new Date(2026, 0, 1, 7, 5))).toBe('07:05')
  })

  it('formatea fecha y hora locales', () => {
    expect(formatoFechaHora(new Date(2026, 10, 6, 14, 30).toISOString())).toBe('06/11 14:30')
    expect(formatoFechaHora(null)).toBe('-')
  })

  it('devuelve el mes corto y el día de la semana', () => {
    const fecha = new Date(2026, 11, 25)
    expect(mesCorto(fecha)).toBe('DIC')
    expect(diaSemana(fecha)).toBe('viernes')
  })
})

describe('conversión ISO', () => {
  it('aIsoFecha usa los componentes locales con ceros', () => {
    expect(aIsoFecha(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(aIsoFecha(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })

  it('desdeIsoFecha y aIsoFecha son inversas', () => {
    expect(aIsoFecha(desdeIsoFecha('2028-02-29'))).toBe('2028-02-29')
  })

  it('desdeIsoFecha devuelve null sin valor', () => {
    expect(desdeIsoFecha(null)).toBeNull()
  })

  it('hoyIso respeta el reloj', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 15, 12))
    expect(hoyIso()).toBe('2026-06-15')
  })
})

describe('aritmética de fechas', () => {
  it.each([
    ['2026-01-31', 1, '2026-02-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2027-02-28', 1, '2027-03-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-05-10', 0, '2026-05-10'],
    ['2026-01-01', 365, '2027-01-01'],
  ])('sumarDias(%s, %i) = %s', (inicio, dias, esperado) => {
    expect(sumarDias(inicio, dias)).toBe(esperado)
  })

  it('diasEntre cuenta días y respeta el signo', () => {
    expect(diasEntre('2026-01-01', '2026-03-01')).toBe(59)
    expect(diasEntre('2026-03-01', '2026-01-01')).toBe(-59)
    expect(diasEntre('2026-04-10', '2026-04-10')).toBe(0)
  })

  it('diasEntre cruza el cambio de hora de otras zonas sin perder un día', () => {
    expect(diasEntre('2026-03-07', '2026-03-09')).toBe(2)
    expect(diasEntre('2026-10-30', '2026-11-02')).toBe(3)
  })
})

describe('horasDesde', () => {
  it('redondea hacia abajo', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-06T12:00:00Z'))
    expect(horasDesde('2026-11-06T09:30:00Z')).toBe(2)
    expect(horasDesde('2026-11-06T11:59:00Z')).toBe(0)
  })
})

describe('campos de fecha y hora', () => {
  it('desdeInputDateTime y aInputDateTime son inversas', () => {
    const iso = desdeInputDateTime('2026-03-05', '09:30')
    expect(aInputDateTime(iso)).toEqual({ fecha: '2026-03-05', hora: '09:30' })
  })

  it('desdeInputDateTime devuelve un ISO en UTC', () => {
    expect(desdeInputDateTime('2026-03-05', '09:30')).toMatch(/^2026-03-05T\d{2}:30:00\.000Z$|^2026-03-0[46]T/)
  })
})
