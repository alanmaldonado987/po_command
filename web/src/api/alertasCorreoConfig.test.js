import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { constructorFalso } from '../test/constructorFalso'

const { cliente } = vi.hoisted(() => ({ cliente: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } } }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => cliente }))

const alertas = await import('./alertas')
const correo = await import('./correo')
const ia = await import('./ia')
const configuracion = await import('./configuracion')

beforeEach(() => {
  vi.clearAllMocks()
  cliente.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null })
})
afterEach(() => vi.useRealTimers())

function usarConstructor(resultado) {
  const falso = constructorFalso(resultado ?? { data: [], error: null })
  cliente.from.mockReturnValue(falso.constructor)
  return falso
}

describe('api/alertas · tablas', () => {
  it('listarReglas ordena por id', async () => {
    const falso = usarConstructor()
    await alertas.listarReglas()
    expect(cliente.from).toHaveBeenCalledWith('regla_alerta')
    expect(falso.llamada('order')).toEqual(['id'])
  })

  it('actualizarRegla aplica solo los cambios indicados', async () => {
    const falso = usarConstructor({ data: null, error: null })
    await alertas.actualizarRegla(3, { activa: false })
    expect(falso.llamada('update')).toEqual([{ activa: false }])
    expect(falso.llamada('eq')).toEqual(['id', 3])
  })

  it('listarCola filtra por estado, ordena descendente y limita a 200', async () => {
    const falso = usarConstructor()
    await alertas.listarCola('Fallida')
    expect(falso.llamada('eq')).toEqual(['estado', 'Fallida'])
    expect(falso.llamada('order')).toEqual(['enviar_en', { ascending: false }])
    expect(falso.llamada('limit')).toEqual([200])
  })

  it('listarProximasAlertas pide solo pendientes con el límite', async () => {
    const falso = usarConstructor()
    await alertas.listarProximasAlertas(3)
    expect(falso.llamada('eq')).toEqual(['estado', 'Pendiente'])
    expect(falso.llamada('limit')).toEqual([3])
  })

  it('obtenerCuerpoAlerta devuelve solo el HTML', async () => {
    usarConstructor({ data: { cuerpo_html: '<p>Hola</p>' }, error: null })
    await expect(alertas.obtenerCuerpoAlerta(9)).resolves.toBe('<p>Hola</p>')
  })

  it('cancelarAlertas solo afecta a las pendientes seleccionadas', async () => {
    const falso = usarConstructor({ data: null, error: null })
    await alertas.cancelarAlertas([1, 2])
    expect(falso.llamada('update')).toEqual([{ estado: 'Cancelada' }])
    expect(falso.llamada('in')).toEqual(['id', [1, 2]])
    expect(falso.llamada('eq')).toEqual(['estado', 'Pendiente'])
  })

  it('reintentarAlertas reinicia estado, hora, error e intentos', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-06T15:00:00Z'))
    const falso = usarConstructor({ data: null, error: null })
    await alertas.reintentarAlertas([4])
    expect(falso.llamada('update')[0]).toEqual({
      estado: 'Pendiente',
      enviar_en: '2026-11-06T15:00:00.000Z',
      error: null,
      intentos: 0,
    })
  })

  it('contarAlertas combina pendientes, fallidas y enviadas de hoy', async () => {
    cliente.from
      .mockReturnValueOnce(constructorFalso({ count: 4, error: null }).constructor)
      .mockReturnValueOnce(constructorFalso({ count: 2, error: null }).constructor)
      .mockReturnValueOnce(constructorFalso({ count: 9, error: null }).constructor)
    await expect(alertas.contarAlertas()).resolves.toEqual({ pendientes: 4, fallidas: 2, enviadasHoy: 9 })
  })

  it('contarAlertas propaga errores', async () => {
    cliente.from.mockReturnValue(constructorFalso({ count: null, error: { message: 'sin acceso' } }).constructor)
    await expect(alertas.contarAlertas()).rejects.toThrow('sin acceso')
  })

  it('listarLog y listarAlertasPorRegla', async () => {
    const falso = usarConstructor()
    await alertas.listarLog(10)
    expect(falso.llamada('limit')).toEqual([10])
    await alertas.listarAlertasPorRegla()
    expect(falso.llamada('not')).toEqual(['regla_codigo', 'is', null])
  })
})

describe('api/alertas · funciones', () => {
  it.each([
    ['revisarReglasAhora', [], { accion: 'tick' }],
    ['despacharCola', [], { accion: 'despachar' }],
    ['notificarItemGuardado', [{ id: 1 }], { accion: 'item_guardado', resultado: { id: 1 } }],
    ['escalarBloqueo', [8], { accion: 'escalar', bloqueante_id: 8 }],
    ['enviarResumenSemanal', [], { accion: 'resumen' }],
    ['recordarVencimientos', [[1, 2]], { accion: 'recordar', item_ids: [1, 2] }],
    ['invitarCeremonia', [5], { accion: 'invitar_ceremonia', ceremonia_id: 5 }],
    ['resolverDestinatarios', [{ regla_codigo: 'X' }], { accion: 'destinatarios', regla_codigo: 'X' }],
  ])('%s invoca la función alertas con el cuerpo correcto', async (nombre, argumentos, cuerpo) => {
    await alertas[nombre](...argumentos)
    expect(cliente.functions.invoke).toHaveBeenCalledWith('alertas', { body: cuerpo })
  })
})

describe('api/correo e ia', () => {
  it.each([
    ['obtenerConfigCorreo', [], { accion: 'estado' }],
    ['guardarConfigCorreo', [{ host: 'h' }], { accion: 'guardar', valores: { host: 'h' } }],
    ['probarConexionCorreo', [], { accion: 'probar' }],
    ['enviarCorreoPrueba', ['a@b.co'], { accion: 'prueba', destino: 'a@b.co' }],
    ['cambiarModoEnvio', [false], { accion: 'modo', dry_run: false }],
  ])('%s invoca la función correo', async (nombre, argumentos, cuerpo) => {
    await correo[nombre](...argumentos)
    expect(cliente.functions.invoke).toHaveBeenCalledWith('correo', { body: cuerpo })
  })

  it('ia: estado y redactar', async () => {
    await ia.obtenerEstadoIa()
    expect(cliente.functions.invoke).toHaveBeenLastCalledWith('ia', { body: { accion: 'estado' } })
    await ia.redactarConModelo({ pregunta: 'p', borrador: 'b', historial: [] })
    expect(cliente.functions.invoke).toHaveBeenLastCalledWith('ia', {
      body: { accion: 'redactar', pregunta: 'p', borrador: 'b', historial: [] },
    })
  })
})

describe('api/configuracion', () => {
  it('obtenerConfiguracion devuelve un objeto clave-valor', async () => {
    usarConstructor({ data: [{ clave: 'po_nombre', valor: 'Vero' }, { clave: 'po_correo', valor: 'v@x.co' }], error: null })
    await expect(configuracion.obtenerConfiguracion()).resolves.toEqual({ po_nombre: 'Vero', po_correo: 'v@x.co' })
  })

  it('guardarConfiguracion hace upsert por clave', async () => {
    const falso = usarConstructor({ data: null, error: null })
    await configuracion.guardarConfiguracion('po_nombre', 'Ana')
    expect(falso.llamada('upsert')).toEqual([{ clave: 'po_nombre', valor: 'Ana' }, { onConflict: 'clave' }])
  })

  it('listarAuditoria ordena por id descendente con límite 500', async () => {
    const falso = usarConstructor()
    await configuracion.listarAuditoria()
    expect(falso.llamada('order')).toEqual(['id', { ascending: false }])
    expect(falso.llamada('limit')).toEqual([500])
  })

  it('importarPlan envía filas y bandera de simulación', async () => {
    cliente.rpc.mockReturnValue(constructorFalso({ data: { nuevos: 1 }, error: null }).constructor)
    await expect(configuracion.importarPlan([{ clave: 'x' }], true)).resolves.toEqual({ nuevos: 1 })
    expect(cliente.rpc).toHaveBeenCalledWith('importar_plan', { p_filas: [{ clave: 'x' }], p_simular: true })
  })

  it('leerTabla pagina todas las filas ordenadas', async () => {
    const falso = usarConstructor()
    await configuracion.leerTabla('item')
    expect(cliente.from).toHaveBeenCalledWith('item')
    expect(falso.llamada('range')).toEqual([0, 999])
  })

  it('TABLAS_EXPORTABLES incluye las tablas principales', () => {
    expect(configuracion.TABLAS_EXPORTABLES).toEqual(expect.arrayContaining(['item', 'nota', 'persona', 'auditoria']))
  })
})
