import { describe, expect, it } from 'vitest'
import { explicarError, ordenarAbiertos } from './colaClickUp'

describe('ordenarAbiertos', () => {
  it('pone los fallidos antes que los pendientes y dentro de cada grupo lo más nuevo primero', () => {
    const filas = [
      { id: 1, estado: 'Pendiente' },
      { id: 2, estado: 'Fallida' },
      { id: 5, estado: 'Pendiente' },
      { id: 4, estado: 'Fallida' },
    ]
    expect(ordenarAbiertos(filas).map((fila) => fila.id)).toEqual([4, 2, 5, 1])
  })

  it('no modifica la lista original', () => {
    const filas = [{ id: 1, estado: 'Pendiente' }, { id: 2, estado: 'Fallida' }]
    ordenarAbiertos(filas)
    expect(filas.map((fila) => fila.id)).toEqual([1, 2])
  })
})

describe('explicarError', () => {
  it.each([
    ['Sin destino configurado para Desarrollo / AIR-E', /tarjeta Destinos/],
    ['ClickUp 401: Token invalid', /token personal/],
    ['ClickUp 403 Forbidden', /token personal/],
    ['ClickUp 404: Task not found', /no encontró la tarea/],
    ['ClickUp 429: Rate limit reached', /se reintenta solo/],
    ['ClickUp 400: Status does not exist', /mapeo de estados/],
    ['Estado no válido en la lista', /mapeo de estados/],
    ['ClickUp 503 Service Unavailable', /error de su servidor o de red/],
    ['request timeout', /error de su servidor o de red/],
  ])('reconoce «%s»', (texto, esperado) => {
    expect(explicarError(texto)).toMatch(esperado)
  })

  it('el destino faltante gana sobre otros códigos del mismo texto', () => {
    expect(explicarError('Sin destino configurado (404)')).toMatch(/tarjeta Destinos/)
  })

  it.each([['algo raro pasó'], [''], [null], [undefined]])('sin patrón conocido no inventa causa: %s', (texto) => {
    expect(explicarError(texto)).toBeNull()
  })
})
