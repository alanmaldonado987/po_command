import { describe, expect, it } from 'vitest'
import { JERARQUIA_CLICKUP } from '../../test/apiFalsa'
import { aplanarListas, buscarLista, estadosDeDestinos, listasDe, opcionesDeCarpeta, SIN_CARPETA } from './jerarquia'

const { espacios } = JERARQUIA_CLICKUP
const [espacio] = espacios

describe('aplanarListas', () => {
  it('une las listas sueltas y las de carpeta con su ruta completa', () => {
    expect(aplanarListas(espacios).map((lista) => lista.ruta)).toEqual([
      'Innovación y Desarrollo OTC / Backlog Dev',
      'Innovación y Desarrollo OTC / Plan de Trabajo / AIR-E',
      'Innovación y Desarrollo OTC / Plan de Trabajo / ELECTROHUILA',
    ])
  })

  it('tolera una jerarquía vacía', () => {
    expect(aplanarListas()).toEqual([])
    expect(aplanarListas([])).toEqual([])
  })
})

describe('buscarLista', () => {
  it('encuentra una lista por id y devuelve null si no existe', () => {
    expect(buscarLista(espacios, 'l2').nombre).toBe('ELECTROHUILA')
    expect(buscarLista(espacios, 'no-existe')).toBeNull()
  })
})

describe('listasDe y opcionesDeCarpeta', () => {
  it('devuelve las listas de una carpeta o las sueltas del espacio', () => {
    expect(listasDe(espacio, 'f1').map((lista) => lista.id)).toEqual(['l1', 'l2'])
    expect(listasDe(espacio, SIN_CARPETA).map((lista) => lista.id)).toEqual(['l9'])
    expect(listasDe(espacio, 'otra')).toEqual([])
    expect(listasDe(undefined, 'f1')).toEqual([])
  })

  it('ofrece «Sin carpeta» solo si el espacio tiene listas sueltas', () => {
    expect(opcionesDeCarpeta(espacio)).toEqual([
      { value: SIN_CARPETA, label: 'Sin carpeta' },
      { value: 'f1', label: 'Plan de Trabajo' },
    ])
    expect(opcionesDeCarpeta({ ...espacio, listas: [] })).toEqual([{ value: 'f1', label: 'Plan de Trabajo' }])
    expect(opcionesDeCarpeta(undefined)).toEqual([])
  })
})

describe('estadosDeDestinos', () => {
  const lista = (id, estados) => ({ id, nombre: id, estados })
  const arbol = [{ id: 's', nombre: 'S', carpetas: [], listas: [lista('a', ['X', 'Y']), lista('b', ['Y', 'Z']), lista('c', ['W'])] }]

  it('une sin repetir los estados de las listas elegidas como destino', () => {
    const destinos = [{ lista_id: 'a' }, { lista_id: 'b' }]
    expect(estadosDeDestinos(arbol, destinos)).toEqual(['X', 'Y', 'Z'])
  })

  it('sin destinos usa los estados de todas las listas', () => {
    expect(estadosDeDestinos(arbol, [])).toEqual(['X', 'Y', 'Z', 'W'])
  })

  it('ignora destinos cuya lista ya no existe', () => {
    expect(estadosDeDestinos(arbol, [{ lista_id: 'borrada' }, { lista_id: 'c' }])).toEqual(['W'])
  })
})
