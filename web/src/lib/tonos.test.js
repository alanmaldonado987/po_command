import { describe, expect, it } from 'vitest'
import { cx } from './cx'
import { CLASES_TONO, tonoEstado, tonoPersona, tonoSeveridad } from './tonos'

describe('cx', () => {
  it('une clases y descarta valores falsos', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b')
  })

  it('sin argumentos devuelve cadena vacía', () => {
    expect(cx()).toBe('')
  })
})

describe('tonos', () => {
  it.each([
    ['En curso', 'azul'],
    ['Terminado', 'verde'],
    ['Terminado, en etapa de pruebas', 'ambar'],
    ['Bloqueado', 'rojo'],
    ['Suspendido', 'violeta'],
    ['Fallida', 'rojo'],
    ['Cancelada', 'gris'],
    ['Reprogramación', 'ambar'],
  ])('tonoEstado(%s) = %s', (estado, tono) => {
    expect(tonoEstado(estado)).toBe(tono)
  })

  it('un estado desconocido es gris', () => {
    expect(tonoEstado('Inventado')).toBe('gris')
  })

  it('cada tono resuelto tiene clases definidas', () => {
    ;['En curso', 'Terminado', 'Bloqueado', 'Suspendido', 'Pendiente'].forEach((estado) => {
      expect(CLASES_TONO[tonoEstado(estado)]).toBeTruthy()
    })
  })

  it('tonoSeveridad distingue Alta', () => {
    expect(tonoSeveridad('Alta')).toBe('rojo')
    expect(tonoSeveridad('Media')).toBe('ambar')
  })

  it('tonoPersona diferencia equipo de stakeholder', () => {
    expect(tonoPersona('equipo')).toBe('azul')
    expect(tonoPersona('stakeholder')).toBe('ambar')
  })
})
