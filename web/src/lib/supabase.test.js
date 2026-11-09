import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cliente } = vi.hoisted(() => ({ cliente: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } } }))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => cliente) }))

const { consultar, consultarTodo, invocarFuncion } = await import('./supabase')

beforeEach(() => vi.clearAllMocks())

describe('consultar', () => {
  it('devuelve data cuando no hay error', async () => {
    await expect(consultar(Promise.resolve({ data: [1, 2], error: null }))).resolves.toEqual([1, 2])
  })

  it('lanza Error con el mensaje de Supabase', async () => {
    await expect(consultar(Promise.resolve({ data: null, error: { message: 'permiso denegado' } }))).rejects.toThrow(
      'permiso denegado',
    )
  })
})

describe('invocarFuncion', () => {
  it('envía el cuerpo y devuelve los datos', async () => {
    cliente.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null })
    await expect(invocarFuncion('alertas', { accion: 'tick' })).resolves.toEqual({ ok: true })
    expect(cliente.functions.invoke).toHaveBeenCalledWith('alertas', { body: { accion: 'tick' } })
  })

  it('usa cuerpo vacío por defecto', async () => {
    cliente.functions.invoke.mockResolvedValue({ data: {}, error: null })
    await invocarFuncion('ia')
    expect(cliente.functions.invoke).toHaveBeenCalledWith('ia', { body: {} })
  })

  it('propaga el detalle JSON del error cuando existe', async () => {
    cliente.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: 'Bloqueo ya resuelto' }) } },
    })
    await expect(invocarFuncion('alertas', {})).rejects.toThrow('Bloqueo ya resuelto')
  })

  it('usa el mensaje original si no hay detalle legible', async () => {
    cliente.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Failed to send a request', context: { json: async () => Promise.reject(new Error('x')) } },
    })
    await expect(invocarFuncion('alertas', {})).rejects.toThrow('Failed to send a request')
  })

  it('usa el mensaje original cuando el error no trae contexto', async () => {
    cliente.functions.invoke.mockResolvedValue({ data: null, error: { message: 'sin red' } })
    await expect(invocarFuncion('alertas', {})).rejects.toThrow('sin red')
  })

  it('trata {error} dentro de data como fallo', async () => {
    cliente.functions.invoke.mockResolvedValue({ data: { error: 'SMTP rechazado' }, error: null })
    await expect(invocarFuncion('correo', {})).rejects.toThrow('SMTP rechazado')
  })
})

describe('consultarTodo', () => {
  const paginaDe = (cantidad) => Array.from({ length: cantidad }, (_, indice) => ({ id: indice }))

  it('pide páginas de 1000 filas hasta recibir una incompleta', async () => {
    const rangos = []
    const respuestas = [paginaDe(1000), paginaDe(1000), paginaDe(37)]
    const crearConsulta = () => ({
      range: (desde, hasta) => {
        rangos.push([desde, hasta])
        return Promise.resolve({ data: respuestas.shift(), error: null })
      },
    })

    const filas = await consultarTodo(crearConsulta)

    expect(filas).toHaveLength(2037)
    expect(rangos).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('con una sola página incompleta hace una única petición', async () => {
    const range = vi.fn().mockResolvedValue({ data: paginaDe(3), error: null })
    await expect(consultarTodo(() => ({ range }))).resolves.toHaveLength(3)
    expect(range).toHaveBeenCalledTimes(1)
  })

  it('propaga el error de una página', async () => {
    const range = vi.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } })
    await expect(consultarTodo(() => ({ range }))).rejects.toThrow('timeout')
  })
})
