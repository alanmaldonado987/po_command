import { beforeEach, describe, expect, it, vi } from 'vitest'
import { constructorFalso } from '../test/constructorFalso'

const { cliente } = vi.hoisted(() => ({ cliente: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } } }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => cliente }))

const api = await import('./items')

beforeEach(() => vi.clearAllMocks())

describe('api/items', () => {
  it('listarItems consulta v_item ordenada por jerarquía', async () => {
    const falso = constructorFalso({ data: [{ id: 1 }], error: null })
    cliente.from.mockReturnValue(falso.constructor)
    await expect(api.listarItems()).resolves.toEqual([{ id: 1 }])
    expect(cliente.from).toHaveBeenCalledWith('v_item')
    expect(falso.todas('order').map(([campo]) => campo)).toEqual(['cliente', 'actividad', 'modulo', 'funcionalidad', 'alcance', 'id'])
  })

  it('guardarItem llama a la RPC con los parámetros nombrados', async () => {
    cliente.rpc.mockReturnValue(constructorFalso({ data: { id: 5 }, error: null }).constructor)
    await api.guardarItem({ datos: { funcionalidad: 'X' }, id: 5, nota: 'n', tipoNota: 'Ejecución', autor: 'PO' })
    expect(cliente.rpc).toHaveBeenCalledWith('guardar_item', {
      p_data: { funcionalidad: 'X' },
      p_id: 5,
      p_nota: 'n',
      p_tipo_nota: 'Ejecución',
      p_autor: 'PO',
    })
  })

  it('guardarItem usa valores por defecto al crear', async () => {
    cliente.rpc.mockReturnValue(constructorFalso({ data: {}, error: null }).constructor)
    await api.guardarItem({ datos: {} })
    expect(cliente.rpc).toHaveBeenCalledWith('guardar_item', {
      p_data: {},
      p_id: null,
      p_nota: '',
      p_tipo_nota: 'Seguimiento',
      p_autor: '',
    })
  })

  it('eliminarItem usa la RPC eliminar_item', async () => {
    cliente.rpc.mockReturnValue(constructorFalso({ data: 3, error: null }).constructor)
    await expect(api.eliminarItem(9)).resolves.toBe(3)
    expect(cliente.rpc).toHaveBeenCalledWith('eliminar_item', { p_id: 9 })
  })

  it('listarNotas filtra por ítem y ordena de más reciente a más antigua', async () => {
    const falso = constructorFalso()
    cliente.from.mockReturnValue(falso.constructor)
    await api.listarNotas(7)
    expect(cliente.from).toHaveBeenCalledWith('nota')
    expect(falso.llamada('eq')).toEqual(['item_id', 7])
    expect(falso.todas('order')).toEqual([['fecha', { ascending: false }], ['id', { ascending: false }]])
  })

  it('eliminarNota borra por id', async () => {
    const falso = constructorFalso({ data: null, error: null })
    cliente.from.mockReturnValue(falso.constructor)
    await api.eliminarNota(4)
    expect(falso.llamada('delete')).toEqual([])
    expect(falso.llamada('eq')).toEqual(['id', 4])
  })

  it('listarBloqueantesAbiertos usa la vista ordenada por apertura', async () => {
    const falso = constructorFalso()
    cliente.from.mockReturnValue(falso.constructor)
    await api.listarBloqueantesAbiertos()
    expect(cliente.from).toHaveBeenCalledWith('v_bloqueante_abierto')
    expect(falso.llamada('order')).toEqual(['abierto_en'])
  })

  it('listarTodasLasNotas y listarBloqueantes seleccionan solo columnas necesarias', async () => {
    const falso = constructorFalso()
    cliente.from.mockReturnValue(falso.constructor)
    await api.listarTodasLasNotas()
    await api.listarBloqueantes()
    expect(falso.todas('select')[0][0]).toContain('tipo')
    expect(falso.todas('select')[1][0]).toContain('resuelto_en')
  })

  it('propaga los errores de la base', async () => {
    cliente.from.mockReturnValue(constructorFalso({ data: null, error: { message: 'RLS' } }).constructor)
    await expect(api.listarItems()).rejects.toThrow('RLS')
  })
})
