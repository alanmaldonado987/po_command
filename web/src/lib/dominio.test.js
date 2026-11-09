import { describe, expect, it } from 'vitest'
import { crearItem } from '../test/fabricas'
import {
  avancePorCliente,
  cargaPorResponsable,
  conteoPorEstado,
  estaAbierto,
  estadoVisible,
  etiquetaItem,
  itemsAtrasados,
  itemsPorVencer,
  porcentajeAvance,
} from './dominio'

describe('estaAbierto', () => {
  it.each([
    ['No iniciado', true],
    ['En curso', true],
    ['Terminado, en etapa de pruebas', true],
    ['Terminado', false],
    ['Suspendido', false],
  ])('%s => %s', (estado, abierto) => {
    expect(estaAbierto(crearItem({ estado }))).toBe(abierto)
  })
})

describe('estadoVisible', () => {
  it('un ítem bloqueado se muestra como Bloqueado', () => {
    expect(estadoVisible(crearItem({ bloqueado: true, estado: 'En curso' }))).toBe('Bloqueado')
  })

  it('sin bloqueo conserva su estado', () => {
    expect(estadoVisible(crearItem({ estado: 'Suspendido' }))).toBe('Suspendido')
  })
})

describe('itemsAtrasados', () => {
  it('filtra por el flag calculado en la base', () => {
    const lista = [crearItem({ atrasado: true }), crearItem({ atrasado: false })]
    expect(itemsAtrasados(lista)).toHaveLength(1)
  })
})

describe('itemsPorVencer', () => {
  const hoy = '2026-11-06'

  it('incluye vencidos y los que vencen dentro del plazo, ordenados por fecha', () => {
    const lista = [
      crearItem({ codigo: 'B', fecha_compromiso: '2026-11-12' }),
      crearItem({ codigo: 'A', fecha_compromiso: '2026-10-30' }),
      crearItem({ codigo: 'C', fecha_compromiso: '2026-11-14' }),
    ]
    expect(itemsPorVencer(lista, 7, hoy).map((i) => i.codigo)).toEqual(['A', 'B'])
  })

  it('el límite es inclusivo', () => {
    const lista = [crearItem({ fecha_compromiso: '2026-11-13' })]
    expect(itemsPorVencer(lista, 7, hoy)).toHaveLength(1)
  })

  it('excluye cerrados y sin fecha', () => {
    const lista = [
      crearItem({ estado: 'Terminado', fecha_compromiso: '2026-11-01' }),
      crearItem({ estado: 'Suspendido', fecha_compromiso: '2026-11-01' }),
      crearItem({ fecha_compromiso: null }),
    ]
    expect(itemsPorVencer(lista, 7, hoy)).toEqual([])
  })
})

describe('cargaPorResponsable', () => {
  it('cuenta abiertos y atrasados, y agrupa sin responsable', () => {
    const lista = [
      crearItem({ responsable: 'Ana', atrasado: true }),
      crearItem({ responsable: 'Ana' }),
      crearItem({ responsable: null }),
      crearItem({ responsable: 'Ana', estado: 'Terminado' }),
    ]
    expect(cargaPorResponsable(lista)).toEqual({
      Ana: { abiertos: 2, atrasados: 1 },
      'Sin asignar': { abiertos: 1, atrasados: 0 },
    })
  })
})

describe('conteoPorEstado', () => {
  it('reparte cada ítem en su contador', () => {
    const lista = ['Terminado', 'Terminado, en etapa de pruebas', 'En curso', 'No iniciado', 'Suspendido', 'En curso'].map(
      (estado) => crearItem({ estado }),
    )
    expect(conteoPorEstado(lista)).toEqual({
      total: 6,
      terminados: 1,
      pruebas: 1,
      enCurso: 2,
      noIniciados: 1,
      suspendidos: 1,
    })
  })

  it('con lista vacía todo es cero', () => {
    expect(conteoPorEstado([]).total).toBe(0)
  })
})

describe('avancePorCliente', () => {
  it('ordena clientes y usa Sin cliente', () => {
    const lista = [
      crearItem({ cliente: 'ELECTROHUILA' }),
      crearItem({ cliente: null }),
      crearItem({ cliente: 'AIR-E', estado: 'Terminado' }),
    ]
    const avance = avancePorCliente(lista)
    expect(avance.map((fila) => fila.cliente)).toEqual(['AIR-E', 'ELECTROHUILA', 'Sin cliente'])
    expect(avance[0].terminados).toBe(1)
  })
})

describe('porcentajeAvance', () => {
  it('calcula terminados sobre el total', () => {
    const lista = [crearItem({ estado: 'Terminado' }), crearItem(), crearItem(), crearItem()]
    expect(porcentajeAvance(lista)).toBe(25)
  })

  it('sin ítems es cero', () => {
    expect(porcentajeAvance([])).toBe(0)
  })
})

describe('etiquetaItem', () => {
  it('compone código, actividad, título y alcance', () => {
    const item = crearItem({ codigo: 'BL-010', actividad: 'SCR', titulo: 'Mapa', alcance: 'Mobile' })
    expect(etiquetaItem(item)).toBe('BL-010 · SCR · Mapa (Mobile)')
  })

  it('usa guiones cuando faltan datos', () => {
    const item = crearItem({ codigo: 'BL-011', actividad: null, titulo: 'Mapa', alcance: '' })
    expect(etiquetaItem(item)).toBe('BL-011 · - · Mapa (-)')
  })
})
