import { describe, expect, it } from 'vitest'
import { aLista, aValorMapeo, dividirEstados, hacerPrincipal } from './mapeoEstados'

describe('mapeoEstados', () => {
  it('aLista acepta texto, lista y valores vacíos', () => {
    expect(aLista('ENTREGADO')).toEqual(['ENTREGADO'])
    expect(aLista(['ENTREGADO', 'LISTO'])).toEqual(['ENTREGADO', 'LISTO'])
    expect(aLista(undefined)).toEqual([])
    expect(aLista('')).toEqual([])
    expect(aLista(['A', '', '  ', null, 'B'])).toEqual(['A', 'B'])
  })

  it('aValorMapeo guarda texto cuando hay uno solo y lista cuando hay varios', () => {
    expect(aValorMapeo([])).toBe('')
    expect(aValorMapeo(['ENTREGADO'])).toBe('ENTREGADO')
    expect(aValorMapeo(['ENTREGADO', 'LISTO'])).toEqual(['ENTREGADO', 'LISTO'])
  })

  it('dividirEstados separa por coma, recorta y quita vacíos y repetidos', () => {
    expect(dividirEstados(' Doing , En curso,, Doing ')).toEqual(['Doing', 'En curso'])
    expect(dividirEstados('')).toEqual([])
  })

  it('hacerPrincipal mueve el estado al principio sin perder los demás', () => {
    expect(hacerPrincipal(['A', 'B', 'C'], 'C')).toEqual(['C', 'A', 'B'])
    expect(hacerPrincipal(['A', 'B'], 'A')).toEqual(['A', 'B'])
  })
})
