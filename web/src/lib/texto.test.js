import { describe, expect, it } from 'vitest'
import { agrupar, correoValido, iniciales, limpiar, normalizar, porcentaje, valoresUnicos } from './texto'

describe('correoValido', () => {
  it.each(['a@b.co', ' a@b.co ', 'nombre.apellido@ises.com.co'])('acepta %s', (correo) => {
    expect(correoValido(correo)).toBe(true)
  })

  it.each(['', 'sin-arroba', 'a@b', '@b.co', 'a b@c.co', null, undefined])('rechaza %s', (correo) => {
    expect(correoValido(correo)).toBe(false)
  })
})

describe('limpiar', () => {
  it('recorta y colapsa espacios', () => {
    expect(limpiar('  Torre   de \n Control ')).toBe('Torre de Control')
  })

  it('devuelve cadena vacía con null o undefined', () => {
    expect(limpiar(null)).toBe('')
    expect(limpiar(undefined)).toBe('')
  })

  it('convierte números a texto', () => {
    expect(limpiar(12)).toBe('12')
  })
})

describe('normalizar', () => {
  it('quita tildes y pasa a minúsculas', () => {
    expect(normalizar('  Órdenes  Ñandú ')).toBe('ordenes nandu')
  })

  it('es idempotente', () => {
    expect(normalizar(normalizar('Gestión Social'))).toBe('gestion social')
  })
})

describe('iniciales', () => {
  it('usa primera y última palabra', () => {
    expect(iniciales('Luis Kendor Narvaez')).toBe('LN')
  })

  it('con un solo nombre usa una letra', () => {
    expect(iniciales('dairo')).toBe('D')
  })

  it('sin nombre muestra interrogación', () => {
    expect(iniciales('')).toBe('?')
    expect(iniciales(undefined)).toBe('?')
  })
})

describe('porcentaje', () => {
  it('calcula la proporción', () => {
    expect(porcentaje(1, 4)).toBe(25)
  })

  it('evita dividir por cero', () => {
    expect(porcentaje(3, 0)).toBe(0)
  })
})

describe('agrupar', () => {
  it('agrupa por la clave dada', () => {
    const grupos = agrupar([{ n: 1 }, { n: 2 }, { n: 3 }], (e) => (e.n % 2 ? 'impar' : 'par'))
    expect(grupos.impar).toHaveLength(2)
    expect(grupos.par).toEqual([{ n: 2 }])
  })

  it('con lista vacía devuelve objeto vacío', () => {
    expect(agrupar([], () => 'x')).toEqual({})
  })
})

describe('valoresUnicos', () => {
  it('ordena sin repetir ni incluir vacíos', () => {
    const lista = [{ c: 'b' }, { c: 'Á' }, { c: 'b' }, { c: null }, { c: '' }]
    expect(valoresUnicos(lista, 'c')).toEqual(['Á', 'b'])
  })
})
