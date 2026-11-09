import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { crearItem, crearNota } from '../../test/fabricas'
import { ORDEN_PRIORIDAD, useFiltrosBacklog } from './useFiltrosBacklog'

const airE = crearItem({ codigo: 'BL-100', titulo: 'Mapa de rutas', cliente: 'AIR-E', alcance: 'Web' })
const afinia = crearItem({ codigo: 'BL-101', titulo: 'Facturación', cliente: 'AFINIA', alcance: 'Mobile', bloqueado: true })
const atrasado = crearItem({ codigo: 'BL-102', titulo: 'Reporte', cliente: 'AIR-E', atrasado: true, estado: 'En curso' })
const terminado = crearItem({
  codigo: 'BL-103',
  titulo: 'Cierre',
  cliente: 'ELECTROHUILA',
  estado: 'Terminado',
  descripcion: 'incluye tablero',
})
const items = [airE, afinia, atrasado, terminado]

function usar(notas = []) {
  return renderHook(() => useFiltrosBacklog(items, notas))
}

describe('useFiltrosBacklog', () => {
  it('sin filtros devuelve todo', () => {
    expect(usar().result.current.filtrados).toHaveLength(4)
  })

  it('busca por código, título y descripción sin distinguir mayúsculas', () => {
    const { result } = usar()
    act(() => result.current.cambiar('texto')('bl-101'))
    expect(result.current.filtrados).toEqual([afinia])
    act(() => result.current.cambiar('texto')('TABLERO'))
    expect(result.current.filtrados).toEqual([terminado])
  })

  it('busca también en el texto de las notas', () => {
    const { result } = usar([crearNota({ item_id: airE.id, texto: 'Esperando aprobación del cliente' })])
    act(() => result.current.cambiar('texto')('aprobación'))
    expect(result.current.filtrados).toEqual([airE])
  })

  it('filtra por cliente (varios valores)', () => {
    const { result } = usar()
    act(() => result.current.cambiar('cliente')(['AFINIA']))
    expect(result.current.filtrados).toEqual([afinia])
    act(() => result.current.cambiar('cliente')(['AFINIA', 'AIR-E']))
    expect(result.current.filtrados).toHaveLength(3)
  })

  it('combina filtros con AND', () => {
    const { result } = usar()
    act(() => result.current.cambiar('cliente')(['AIR-E']))
    act(() => result.current.cambiar('alcance')(['Mobile']))
    expect(result.current.filtrados).toEqual([])
  })

  it('el estado Bloqueado y Atrasado son virtuales', () => {
    const { result } = usar()
    act(() => result.current.cambiar('estado')(['Bloqueado']))
    expect(result.current.filtrados).toEqual([afinia])
    act(() => result.current.cambiar('estado')(['Atrasado']))
    expect(result.current.filtrados).toEqual([atrasado])
  })

  it('combina estados reales con virtuales (OR entre ellos)', () => {
    const { result } = usar()
    act(() => result.current.cambiar('estado')(['Terminado', 'Bloqueado']))
    expect(result.current.filtrados).toEqual([afinia, terminado])
  })

  describe('prioridad', () => {
    const urgente = crearItem({ codigo: 'BL-200', prioridad: 'Urgente' })
    const baja = crearItem({ codigo: 'BL-201', prioridad: 'Baja' })
    const alta = crearItem({ codigo: 'BL-202', prioridad: 'Alta' })
    const sinPrioridad = crearItem({ codigo: 'BL-203', prioridad: null })
    const conPrioridad = [baja, sinPrioridad, urgente, alta]
    const usarPrioridades = (lista = conPrioridad) => renderHook(() => useFiltrosBacklog(lista, []))

    it('filtra por una o varias prioridades', () => {
      const { result } = usarPrioridades()
      act(() => result.current.cambiar('prioridad')(['Urgente', 'Baja']))
      expect(result.current.filtrados).toEqual([baja, urgente])
    })

    it('«Sin prioridad» deja solo los ítems sin prioridad', () => {
      const { result } = usarPrioridades()
      act(() => result.current.cambiar('prioridad')(['Sin prioridad']))
      expect(result.current.filtrados).toEqual([sinPrioridad])
    })

    it('por defecto conserva el orden del plan', () => {
      expect(usarPrioridades().result.current.filtrados).toEqual(conPrioridad)
    })

    it('ordenar por prioridad deja Urgente primero y los sin prioridad al final', () => {
      const { result } = usarPrioridades()
      act(() => result.current.cambiar('orden')(ORDEN_PRIORIDAD))
      expect(result.current.filtrados).toEqual([urgente, alta, baja, sinPrioridad])
    })

    it('el orden por prioridad es estable entre ítems con la misma prioridad', () => {
      const primero = crearItem({ codigo: 'BL-210', prioridad: 'Normal' })
      const segundo = crearItem({ codigo: 'BL-211', prioridad: 'Normal' })
      const { result } = usarPrioridades([primero, segundo])
      act(() => result.current.cambiar('orden')(ORDEN_PRIORIDAD))
      expect(result.current.filtrados).toEqual([primero, segundo])
    })
  })
})
