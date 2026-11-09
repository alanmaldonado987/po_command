import { describe, expect, it } from 'vitest'
import { crearItem } from '../../test/fabricas'
import { construirFilasGantt, itemsSinFechas, LEYENDA_TRAMOS, TRAMOS } from './tramos'

describe('TRAMOS', () => {
  it('define cuatro tramos y una leyenda equivalente', () => {
    expect(TRAMOS).toHaveLength(4)
    expect(LEYENDA_TRAMOS).toHaveLength(4)
    expect(TRAMOS.filter((t) => t.ejecutado)).toHaveLength(2)
  })
})

describe('construirFilasGantt', () => {
  it('incluye el día final sumando un día', () => {
    const [fila] = construirFilasGantt([crearItem({ plan_ini: '2026-01-01', plan_fin: '2026-01-10' })])
    expect(fila.tramos[0]).toMatchObject({ inicio: '2026-01-01', fin: '2026-01-11', ejecutado: false })
  })

  it('usa una sola fecha como inicio y fin', () => {
    const [fila] = construirFilasGantt([crearItem({ plan_fin: '2026-02-05' })])
    expect(fila.tramos[0]).toMatchObject({ inicio: '2026-02-05', fin: '2026-02-06' })
  })

  it('genera un tramo por cada par con fechas', () => {
    const item = crearItem({ plan_ini: '2026-01-01', plan_fin: '2026-01-05', real_ini: '2026-01-02', real_fin: '2026-01-08' })
    const [fila] = construirFilasGantt([item])
    expect(fila.tramos.map((t) => t.ejecutado)).toEqual([false, true])
  })

  it('omite ítems sin fechas y ordena por el inicio más temprano', () => {
    const tarde = crearItem({ plan_ini: '2026-05-01', plan_fin: '2026-05-02' })
    const temprano = crearItem({ plan_ini: '2026-02-01', plan_fin: '2026-02-02' })
    const sin = crearItem()
    const filas = construirFilasGantt([tarde, sin, temprano])
    expect(filas.map((f) => f.id)).toEqual([temprano.id, tarde.id])
  })

  it('el detalle describe estado, responsable y atraso', () => {
    const item = crearItem({ plan_fin: '2026-02-05', fecha_compromiso: '2026-02-05', atraso_dias: 3, bloqueado: true })
    const [fila] = construirFilasGantt([item])
    expect(fila.detalle).toContain('Estado: Bloqueado')
    expect(fila.detalle).toContain('Atraso: 3 día(s)')
    expect(fila.detalle).toContain('Fin planificado: 05/02/2026')
  })
})

describe('itemsSinFechas', () => {
  it('devuelve solo los ítems sin ninguna fecha', () => {
    const con = crearItem({ real_ini: '2026-03-01' })
    const sin = crearItem()
    expect(itemsSinFechas([con, sin])).toEqual([sin])
  })
})
