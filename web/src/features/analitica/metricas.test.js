import { describe, expect, it } from 'vitest'
import { crearItem, crearNota } from '../../test/fabricas'
import {
  abiertosYAtrasadosPorResponsable,
  alertasPorRegla,
  calcularKpis,
  conteoPorEstado,
  modulosConMasAtrasos,
  resumenClienteActividad,
} from './metricas'

describe('calcularKpis', () => {
  it('sin datos devuelve ceros y nulos', () => {
    expect(calcularKpis({ items: [], notas: [], bloqueantes: [] })).toEqual({
      total: 0,
      terminados: 0,
      avance: 0,
      entregaATiempo: null,
      atrasados: 0,
      promedioAtraso: 0,
      reprogramaciones: 0,
      horasResolucion: null,
    })
  })

  it('calcula avance, entrega a tiempo y promedio de atraso', () => {
    const items = [
      crearItem({ estado: 'Terminado', fecha_compromiso: '2026-01-10', fecha_entrega: '2026-01-10', atraso_dias: 0 }),
      crearItem({ estado: 'Terminado', fecha_compromiso: '2026-01-10', fecha_entrega: '2026-01-14', atraso_dias: 4 }),
      crearItem({ atrasado: true, atraso_dias: 10 }),
      crearItem({ atrasado: true, atraso_dias: 20 }),
    ]
    const kpis = calcularKpis({ items, notas: [], bloqueantes: [] })
    expect(kpis.avance).toBe(50)
    expect(kpis.entregaATiempo).toBe(50)
    expect(kpis.atrasados).toBe(2)
    expect(kpis.promedioAtraso).toBe(15)
  })

  it('ignora terminados sin fechas al medir entrega a tiempo', () => {
    const items = [crearItem({ estado: 'Terminado', fecha_compromiso: null, fecha_entrega: null })]
    expect(calcularKpis({ items, notas: [], bloqueantes: [] }).entregaATiempo).toBeNull()
  })

  it('cuenta solo reprogramaciones de los ítems en vista', () => {
    const item = crearItem()
    const notas = [
      crearNota({ item_id: item.id, tipo: 'Reprogramación' }),
      crearNota({ item_id: item.id, tipo: 'Seguimiento' }),
      crearNota({ item_id: 99999, tipo: 'Reprogramación' }),
    ]
    expect(calcularKpis({ items: [item], notas, bloqueantes: [] }).reprogramaciones).toBe(1)
  })

  it('promedia horas de resolución solo de bloqueos resueltos de ítems en vista', () => {
    const item = crearItem()
    const bloqueantes = [
      { item_id: item.id, abierto_en: '2026-11-01T00:00:00Z', resuelto_en: '2026-11-01T10:00:00Z' },
      { item_id: item.id, abierto_en: '2026-11-02T00:00:00Z', resuelto_en: '2026-11-02T20:00:00Z' },
      { item_id: item.id, abierto_en: '2026-11-03T00:00:00Z', resuelto_en: null },
      { item_id: 99999, abierto_en: '2026-11-03T00:00:00Z', resuelto_en: '2026-11-04T00:00:00Z' },
    ]
    expect(calcularKpis({ items: [item], notas: [], bloqueantes }).horasResolucion).toBe(15)
  })
})

describe('conteoPorEstado', () => {
  it('agrupa por campo y rellena el valor por defecto', () => {
    const items = [
      crearItem({ actividad: 'SCR', estado: 'Terminado' }),
      crearItem({ actividad: 'SCR', estado: 'En curso' }),
      crearItem({ actividad: null, estado: 'No iniciado' }),
    ]
    const filas = conteoPorEstado(items, 'actividad', 'Sin actividad')
    const scr = filas.find((f) => f.categoria === 'SCR')
    expect(scr.Terminado).toBe(1)
    expect(scr['En curso']).toBe(1)
    expect(filas.find((f) => f.categoria === 'Sin actividad')['No iniciado']).toBe(1)
  })
})

describe('abiertosYAtrasadosPorResponsable', () => {
  it('ordena por abiertos descendente y excluye cerrados', () => {
    const items = [
      crearItem({ responsable: 'Ana' }),
      crearItem({ responsable: 'Beto' }),
      crearItem({ responsable: 'Beto', atrasado: true }),
      crearItem({ responsable: 'Beto', estado: 'Terminado' }),
    ]
    expect(abiertosYAtrasadosPorResponsable(items)).toEqual([
      { responsable: 'Beto', abiertos: 2, atrasados: 1 },
      { responsable: 'Ana', abiertos: 1, atrasados: 0 },
    ])
  })
})

describe('modulosConMasAtrasos', () => {
  const items = [
    ...Array.from({ length: 3 }, () => crearItem({ modulo: 'A', atrasado: true })),
    crearItem({ modulo: 'B', atrasado: true }),
    crearItem({ modulo: 'C' }),
  ]

  it('excluye módulos sin atrasos y ordena', () => {
    expect(modulosConMasAtrasos(items)).toEqual([
      { modulo: 'A', atrasados: 3 },
      { modulo: 'B', atrasados: 1 },
    ])
  })

  it('respeta el límite', () => {
    expect(modulosConMasAtrasos(items, 1)).toHaveLength(1)
  })
})

describe('alertasPorRegla', () => {
  it('cuenta enviadas y fallidas por regla', () => {
    const registros = [
      { regla_codigo: 'X', estado: 'Enviada' },
      { regla_codigo: 'X', estado: 'Fallida' },
      { regla_codigo: 'X', estado: 'Omitida' },
      { regla_codigo: 'Y', estado: 'Enviada' },
    ]
    expect(alertasPorRegla(registros)).toEqual([
      { regla: 'X', Enviadas: 1, Fallidas: 1 },
      { regla: 'Y', Enviadas: 1, Fallidas: 0 },
    ])
  })
})

describe('resumenClienteActividad', () => {
  it('separa por cliente y actividad y cuenta atrasados abiertos', () => {
    const items = [
      crearItem({ cliente: 'AIR-E', actividad: 'SCR', atrasado: true }),
      crearItem({ cliente: 'AIR-E', actividad: 'SCR', estado: 'Terminado' }),
      crearItem({ cliente: null, actividad: null }),
    ]
    const filas = resumenClienteActividad(items)
    const airE = filas.find((f) => f.cliente === 'AIR-E')
    expect(airE.Atrasados).toBe(1)
    expect(airE.Terminado).toBe(1)
    expect(filas.find((f) => f.cliente === 'Sin cliente').actividad).toBe('Sin actividad')
  })
})
