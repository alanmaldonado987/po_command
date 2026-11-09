import { describe, expect, it } from 'vitest'
import { crearItem } from '../../test/fabricas'
import { cargaPorPersona, maximoAbiertos } from './carga'

describe('cargaPorPersona', () => {
  it('cuenta abiertos y atrasados por responsable_id', () => {
    const carga = cargaPorPersona([
      crearItem({ responsable_id: 1, atrasado: true }),
      crearItem({ responsable_id: 1 }),
      crearItem({ responsable_id: 2 }),
    ])
    expect(carga).toEqual({ 1: { abiertos: 2, atrasados: 1 }, 2: { abiertos: 1, atrasados: 0 } })
  })

  it('ignora cerrados y sin responsable', () => {
    const carga = cargaPorPersona([
      crearItem({ responsable_id: 1, estado: 'Terminado' }),
      crearItem({ responsable_id: null }),
    ])
    expect(carga).toEqual({})
  })
})

describe('maximoAbiertos', () => {
  it('devuelve el mayor número de abiertos', () => {
    expect(maximoAbiertos({ 1: { abiertos: 3 }, 2: { abiertos: 5 } })).toBe(5)
  })

  it('nunca baja de 1 para evitar divisiones por cero', () => {
    expect(maximoAbiertos({})).toBe(1)
  })
})
