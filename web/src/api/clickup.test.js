import { beforeEach, describe, expect, it, vi } from 'vitest'
import { constructorFalso } from '../test/constructorFalso'

const { cliente } = vi.hoisted(() => ({ cliente: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } } }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => cliente }))

const api = await import('./clickup')

beforeEach(() => {
  vi.clearAllMocks()
  cliente.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null })
})

const cuerpoEnviado = () => cliente.functions.invoke.mock.calls.at(-1)[1].body

describe('api/clickup · Edge Function', () => {
  it.each([
    ['obtenerEstadoClickUp', [], { accion: 'estado' }],
    ['guardarConfigClickUp', [{ token: 'pk_1', habilitado: true }], { accion: 'guardar_config', token: 'pk_1', habilitado: true }],
    ['probarClickUp', [], { accion: 'probar' }],
    ['obtenerJerarquiaClickUp', ['t1'], { accion: 'jerarquia', equipo_id: 't1' }],
    ['registrarWebhookClickUp', [], { accion: 'registrar_webhook' }],
    ['quitarWebhookClickUp', [], { accion: 'quitar_webhook' }],
    ['sincronizarClickUp', [], { accion: 'sincronizar' }],
    ['reconciliarClickUp', [], { accion: 'reconciliar' }],
    ['reconciliarClickUp', [{ forzar: true }], { accion: 'reconciliar', forzar: true }],
    ['reconciliarClickUp', [{ tableroId: 2 }], { accion: 'reconciliar', tablero_id: 2 }],
    ['reconciliarClickUp', [{ tableroId: 2, forzar: true }], { accion: 'reconciliar', tablero_id: 2, forzar: true }],
    [
      'importarExistentesClickUp',
      [{ listaId: 'l1', clienteId: 3, tableroId: 2 }],
      { accion: 'importar_existentes', lista_id: 'l1', cliente_id: 3, tablero_id: 2 },
    ],
    [
      'importarExistentesClickUp',
      [{ listaId: 'l1' }],
      { accion: 'importar_existentes', lista_id: 'l1', cliente_id: null, tablero_id: null },
    ],
  ])('%s invoca la función clickup con el cuerpo del contrato', async (nombre, argumentos, esperado) => {
    await api[nombre](...argumentos)
    expect(cliente.functions.invoke).toHaveBeenCalledWith('clickup', { body: esperado })
    expect(cuerpoEnviado()).toEqual(esperado)
  })

  it('propaga el error que devuelve la función', async () => {
    cliente.functions.invoke.mockResolvedValue({ data: { error: 'Token inválido' }, error: null })
    await expect(api.probarClickUp()).rejects.toThrow('Token inválido')
  })
})

describe('api/clickup · tablas', () => {
  it('listarDestinos lee clickup_destino ordenado por id', async () => {
    const falso = constructorFalso({ data: [{ id: 1 }], error: null })
    cliente.from.mockReturnValue(falso.constructor)
    await expect(api.listarDestinos()).resolves.toEqual([{ id: 1 }])
    expect(cliente.from).toHaveBeenCalledWith('clickup_destino')
    expect(falso.llamada('select')).toEqual(['id, tablero_id, cliente_id, lista_id, lista_nombre'])
    expect(falso.llamada('order')).toEqual(['id'])
  })

  it('guardarDestino inserta cuando no hay id', async () => {
    const falso = constructorFalso({ data: { id: 5 }, error: null })
    cliente.from.mockReturnValue(falso.constructor)
    await api.guardarDestino({ clienteId: null, listaId: 'l1', listaNombre: 'AIR-E' })
    expect(falso.llamada('insert')).toEqual([
      { tablero_id: null, cliente_id: null, lista_id: 'l1', lista_nombre: 'AIR-E' },
    ])
    expect(falso.llamada('update')).toBeUndefined()
  })

  it('guardarDestino actualiza cuando ya existe', async () => {
    const falso = constructorFalso({ data: { id: 5 }, error: null })
    cliente.from.mockReturnValue(falso.constructor)
    await api.guardarDestino({ id: 5, tableroId: 3, clienteId: 2, listaId: 'l2', listaNombre: 'ELECTROHUILA' })
    expect(falso.llamada('update')).toEqual([
      { tablero_id: 3, cliente_id: 2, lista_id: 'l2', lista_nombre: 'ELECTROHUILA' },
    ])
    expect(falso.llamada('eq')).toEqual(['id', 5])
    expect(falso.llamada('insert')).toBeUndefined()
  })

  it('guardarDestino envía tablero y cliente en el destino nuevo', async () => {
    const falso = constructorFalso({ data: { id: 8 }, error: null })
    cliente.from.mockReturnValue(falso.constructor)
    await api.guardarDestino({ tableroId: 4, clienteId: 2, listaId: 'l3', listaNombre: 'Analitica / AIR-E' })
    expect(falso.llamada('insert')).toEqual([
      { tablero_id: 4, cliente_id: 2, lista_id: 'l3', lista_nombre: 'Analitica / AIR-E' },
    ])
  })

  it('eliminarDestino borra por id', async () => {
    const falso = constructorFalso({ data: null, error: null })
    cliente.from.mockReturnValue(falso.constructor)
    await api.eliminarDestino(4)
    expect(falso.llamada('delete')).toEqual([])
    expect(falso.llamada('eq')).toEqual(['id', 4])
  })

  it('listarColaClickUp trae lo último primero con un límite', async () => {
    const falso = constructorFalso()
    cliente.from.mockReturnValue(falso.constructor)
    await api.listarColaClickUp(10)
    expect(cliente.from).toHaveBeenCalledWith('clickup_cola')
    expect(falso.llamada('order')).toEqual(['id', { ascending: false }])
    expect(falso.llamada('limit')).toEqual([10])
  })

  it('listarColaClickUp usa 30 filas por defecto', async () => {
    const falso = constructorFalso()
    cliente.from.mockReturnValue(falso.constructor)
    await api.listarColaClickUp()
    expect(falso.llamada('limit')).toEqual([30])
  })

  it('listarPendientesDeItem filtra por ítem y por estado Pendiente', async () => {
    const falso = constructorFalso()
    cliente.from.mockReturnValue(falso.constructor)
    await api.listarPendientesDeItem(8)
    expect(falso.todas('eq')).toEqual([['item_id', 8], ['estado', 'Pendiente']])
  })

  it('propaga el error de la consulta', async () => {
    cliente.from.mockReturnValue(constructorFalso({ data: null, error: { message: 'no existe la tabla' } }).constructor)
    await expect(api.listarDestinos()).rejects.toThrow('no existe la tabla')
  })
})

describe('api/clickup · tableros', () => {
  it('listarTableros lee clickup_tablero ordenado por nombre', async () => {
    const falso = constructorFalso({ data: [{ id: 1, nombre: 'Analitica' }], error: null })
    cliente.from.mockReturnValue(falso.constructor)
    await expect(api.listarTableros()).resolves.toEqual([{ id: 1, nombre: 'Analitica' }])
    expect(cliente.from).toHaveBeenCalledWith('clickup_tablero')
    expect(falso.llamada('select')).toEqual(['id, nombre, mapeo_estados'])
    expect(falso.llamada('order')).toEqual(['nombre'])
  })

  it('crearTablero inserta el nombre y devuelve la fila', async () => {
    const falso = constructorFalso({ data: { id: 3, nombre: 'Desarrollo' }, error: null })
    cliente.from.mockReturnValue(falso.constructor)
    await expect(api.crearTablero({ nombre: 'Desarrollo' })).resolves.toEqual({ id: 3, nombre: 'Desarrollo' })
    expect(falso.llamada('insert')).toEqual([{ nombre: 'Desarrollo' }])
  })

  it('actualizarTablero solo envía los campos que cambian', async () => {
    const falso = constructorFalso({ data: { id: 3 }, error: null })
    cliente.from.mockReturnValue(falso.constructor)
    await api.actualizarTablero({ id: 3, nombre: 'Analitica de datos' })
    expect(falso.llamada('update')).toEqual([{ nombre: 'Analitica de datos' }])
    expect(falso.llamada('eq')).toEqual(['id', 3])
  })

  it('actualizarTablero guarda el mapeo propio y permite volver al general con null', async () => {
    const falso = constructorFalso({ data: { id: 3 }, error: null })
    cliente.from.mockReturnValue(falso.constructor)
    await api.actualizarTablero({ id: 3, mapeoEstados: { Terminado: 'LISTO' } })
    expect(falso.llamada('update')).toEqual([{ mapeo_estados: { Terminado: 'LISTO' } }])

    const otro = constructorFalso({ data: { id: 3 }, error: null })
    cliente.from.mockReturnValue(otro.constructor)
    await api.actualizarTablero({ id: 3, mapeoEstados: null })
    expect(otro.llamada('update')).toEqual([{ mapeo_estados: null }])
  })

  it('eliminarTablero borra por id', async () => {
    const falso = constructorFalso({ data: null, error: null })
    cliente.from.mockReturnValue(falso.constructor)
    await api.eliminarTablero(6)
    expect(falso.llamada('delete')).toEqual([])
    expect(falso.llamada('eq')).toEqual(['id', 6])
  })

  it('propaga el error de la consulta de tableros', async () => {
    cliente.from.mockReturnValue(constructorFalso({ data: null, error: { message: 'nombre duplicado' } }).constructor)
    await expect(api.crearTablero({ nombre: 'Desarrollo' })).rejects.toThrow('nombre duplicado')
  })
})
