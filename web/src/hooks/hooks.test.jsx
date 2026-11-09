import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/items', () => ({
  listarItems: vi.fn(),
  listarBloqueantesAbiertos: vi.fn(),
  listarBloqueantes: vi.fn(),
  listarNotas: vi.fn(),
  listarTodasLasNotas: vi.fn(),
  guardarItem: vi.fn(),
  eliminarItem: vi.fn(),
  eliminarNota: vi.fn(),
}))
vi.mock('../api/alertas', () => ({
  reintentarAlertas: vi.fn(),
  despacharCola: vi.fn(),
  cancelarAlertas: vi.fn(),
  actualizarRegla: vi.fn(),
  resolverDestinatarios: vi.fn(),
  escalarBloqueo: vi.fn(),
  notificarItemGuardado: vi.fn(),
  listarReglas: vi.fn(),
  listarCola: vi.fn(),
}))
vi.mock('../api/catalogos', () => ({
  listarCatalogo: vi.fn(),
  crearRegistro: vi.fn(),
  actualizarRegistro: vi.fn(),
  eliminarRegistro: vi.fn(),
}))
vi.mock('../api/personas', () => ({ listarPersonas: vi.fn(), guardarPersona: vi.fn(), eliminarPersona: vi.fn() }))
vi.mock('../api/ceremonias', () => ({
  listarCeremonias: vi.fn(),
  listarAcuerdos: vi.fn(),
  guardarCeremonia: vi.fn(),
  eliminarCeremonia: vi.fn(),
  guardarAcuerdo: vi.fn(),
  eliminarAcuerdo: vi.fn(),
}))
vi.mock('../api/configuracion', () => ({
  obtenerConfiguracion: vi.fn(),
  guardarConfiguracion: vi.fn(),
  listarAuditoria: vi.fn(),
  importarPlan: vi.fn(),
}))
vi.mock('../api/correo', () => ({
  obtenerConfigCorreo: vi.fn(),
  guardarConfigCorreo: vi.fn(),
  probarConexionCorreo: vi.fn(),
  enviarCorreoPrueba: vi.fn(),
  cambiarModoEnvio: vi.fn(),
}))
vi.mock('../api/ia', () => ({ obtenerEstadoIa: vi.fn(), redactarConModelo: vi.fn() }))

const apiItems = await import('../api/items')
const apiAlertas = await import('../api/alertas')
const apiCatalogos = await import('../api/catalogos')
const apiPersonas = await import('../api/personas')
const apiCeremonias = await import('../api/ceremonias')
const apiConfig = await import('../api/configuracion')
const apiCorreo = await import('../api/correo')
const apiIa = await import('../api/ia')
const items = await import('./useItems')
const alertas = await import('./useAlertas')
const catalogos = await import('./useCatalogos')
const personas = await import('./usePersonas')
const ceremonias = await import('./useCeremonias')
const configuracion = await import('./useConfiguracion')
const correo = await import('./useCorreo')
const ia = await import('./useIa')

function preparar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const invalidar = vi.spyOn(cliente, 'invalidateQueries')
  const wrapper = ({ children }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  return { wrapper, invalidar }
}

const clavesInvalidadas = (invalidar) => invalidar.mock.calls.map(([opciones]) => opciones.queryKey[0])

beforeEach(() => vi.clearAllMocks())

describe('consultas', () => {
  it('useItems devuelve los datos de la API', async () => {
    apiItems.listarItems.mockResolvedValue([{ id: 1 }])
    const { wrapper } = preparar()
    const { result } = renderHook(() => items.useItems(), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual([{ id: 1 }]))
  })

  it('useItems expone el error', async () => {
    apiItems.listarItems.mockRejectedValue(new Error('RLS'))
    const { wrapper } = preparar()
    const { result } = renderHook(() => items.useItems(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('RLS')
  })

  it('useNotas no consulta sin itemId y sí con él', async () => {
    apiItems.listarNotas.mockResolvedValue([])
    const { wrapper } = preparar()
    renderHook(() => items.useNotas(null), { wrapper })
    expect(apiItems.listarNotas).not.toHaveBeenCalled()
    renderHook(() => items.useNotas(7), { wrapper })
    await waitFor(() => expect(apiItems.listarNotas).toHaveBeenCalledWith(7))
  })

  it('useCatalogo pasa la tabla a la API', async () => {
    apiCatalogos.listarCatalogo.mockResolvedValue([])
    const { wrapper } = preparar()
    renderHook(() => catalogos.useCatalogo('modulo'), { wrapper })
    await waitFor(() => expect(apiCatalogos.listarCatalogo).toHaveBeenCalledWith('modulo'))
  })

  it('useDestinatarios respeta el flag habilitado', async () => {
    apiAlertas.resolverDestinatarios.mockResolvedValue([{ correo: 'a@b.co' }])
    const { wrapper } = preparar()
    renderHook(() => alertas.useDestinatarios({ regla_codigo: 'X' }, false), { wrapper })
    expect(apiAlertas.resolverDestinatarios).not.toHaveBeenCalled()
    const { result } = renderHook(() => alertas.useDestinatarios({ regla_codigo: 'X' }), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual([{ correo: 'a@b.co' }]))
  })

  it('useEstadoIa no reintenta cuando falla', async () => {
    apiIa.obtenerEstadoIa.mockRejectedValue(new Error('sin función'))
    const { wrapper } = preparar()
    const { result } = renderHook(() => ia.useEstadoIa(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(apiIa.obtenerEstadoIa).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['usePersonas', personas, apiPersonas.listarPersonas],
    ['useCeremonias', ceremonias, apiCeremonias.listarCeremonias],
    ['useAcuerdos', ceremonias, apiCeremonias.listarAcuerdos],
    ['useConfiguracion', configuracion, apiConfig.obtenerConfiguracion],
    ['useConfigCorreo', correo, apiCorreo.obtenerConfigCorreo],
    ['useBloqueantesAbiertos', items, apiItems.listarBloqueantesAbiertos],
    ['useReglas', alertas, apiAlertas.listarReglas],
  ])('%s llama a su API', async (nombre, modulo, funcionApi) => {
    funcionApi.mockResolvedValue([])
    const { wrapper } = preparar()
    renderHook(() => modulo[nombre](), { wrapper })
    await waitFor(() => expect(funcionApi).toHaveBeenCalled())
  })
})

describe('mutaciones e invalidación', () => {
  it('useGuardarItem invalida items, bloqueantes, notas, catálogos, personas, alertas y auditoría', async () => {
    apiItems.guardarItem.mockResolvedValue({ id: 1 })
    const { wrapper, invalidar } = preparar()
    const { result } = renderHook(() => items.useGuardarItem(), { wrapper })
    await act(() => result.current.mutateAsync({ datos: {} }))
    expect(apiItems.guardarItem).toHaveBeenCalledWith({ datos: {} }, expect.anything())
    expect(clavesInvalidadas(invalidar)).toEqual(
      expect.arrayContaining(['items', 'bloqueantes', 'notas', 'catalogo', 'personas', 'alertas', 'auditoria']),
    )
  })

  it('useEliminarNota solo invalida notas', async () => {
    apiItems.eliminarNota.mockResolvedValue(null)
    const { wrapper, invalidar } = preparar()
    const { result } = renderHook(() => items.useEliminarNota(), { wrapper })
    await act(() => result.current.mutateAsync(3))
    expect(clavesInvalidadas(invalidar)).toEqual(['notas'])
  })

  it('una mutación fallida no invalida nada', async () => {
    apiItems.eliminarItem.mockRejectedValue(new Error('fallo'))
    const { wrapper, invalidar } = preparar()
    const { result } = renderHook(() => items.useEliminarItem(), { wrapper })
    await act(async () => {
      await expect(result.current.mutateAsync(1)).rejects.toThrow('fallo')
    })
    expect(invalidar).not.toHaveBeenCalled()
  })

  it('useReintentarAlertas reintenta y luego despacha la cola', async () => {
    apiAlertas.reintentarAlertas.mockResolvedValue(null)
    apiAlertas.despacharCola.mockResolvedValue({ enviadas: 1, fallidas: 0 })
    const { wrapper, invalidar } = preparar()
    const { result } = renderHook(() => alertas.useReintentarAlertas(), { wrapper })
    let respuesta
    await act(async () => {
      respuesta = await result.current.mutateAsync([1, 2])
    })
    expect(apiAlertas.reintentarAlertas).toHaveBeenCalledWith([1, 2])
    expect(respuesta).toEqual({ enviadas: 1, fallidas: 0 })
    expect(clavesInvalidadas(invalidar)).toEqual(['alertas'])
  })

  it('useActualizarRegla traduce id y cambios', async () => {
    apiAlertas.actualizarRegla.mockResolvedValue(null)
    const { wrapper } = preparar()
    const { result } = renderHook(() => alertas.useActualizarRegla(), { wrapper })
    await act(() => result.current.mutateAsync({ id: 2, cambios: { activa: false } }))
    expect(apiAlertas.actualizarRegla).toHaveBeenCalledWith(2, { activa: false })
  })

  it('useNotificarItemGuardado y useEscalarBloqueo invalidan la cola e ítems', async () => {
    apiAlertas.notificarItemGuardado.mockResolvedValue({ mensaje: 'ok' })
    apiAlertas.escalarBloqueo.mockResolvedValue({ ok: true })
    const { wrapper, invalidar } = preparar()
    const a = renderHook(() => alertas.useNotificarItemGuardado(), { wrapper })
    const b = renderHook(() => alertas.useEscalarBloqueo(), { wrapper })
    await act(() => a.result.current.mutateAsync({ id: 1 }))
    await act(() => b.result.current.mutateAsync(4))
    expect(clavesInvalidadas(invalidar)).toEqual(expect.arrayContaining(['alertas', 'items', 'bloqueantes', 'ceremonias']))
  })

  it.each([
    ['crear', 'useCrearRegistro', 'crearRegistro', { tabla: 'cliente', datos: { nombre: 'X' } }, ['cliente', { nombre: 'X' }]],
    ['actualizar', 'useActualizarRegistro', 'actualizarRegistro', { tabla: 'cliente', id: 2, datos: { nombre: 'Y' } }, ['cliente', 2, { nombre: 'Y' }]],
    ['eliminar', 'useEliminarRegistro', 'eliminarRegistro', { tabla: 'modulo', id: 3 }, ['modulo', 3]],
  ])('catálogos: %s traduce los argumentos', async (_nombre, hook, funcionApi, entrada, esperado) => {
    apiCatalogos[funcionApi].mockResolvedValue({})
    const { wrapper, invalidar } = preparar()
    const { result } = renderHook(() => catalogos[hook](), { wrapper })
    await act(() => result.current.mutateAsync(entrada))
    expect(apiCatalogos[funcionApi]).toHaveBeenCalledWith(...esperado)
    expect(clavesInvalidadas(invalidar)).toEqual(expect.arrayContaining(['catalogo', 'items']))
  })

  it('personas, ceremonias y configuración invalidan sus claves', async () => {
    apiPersonas.guardarPersona.mockResolvedValue(1)
    apiCeremonias.eliminarCeremonia.mockResolvedValue(2)
    apiConfig.guardarConfiguracion.mockResolvedValue(null)
    apiConfig.importarPlan.mockResolvedValue({})
    const { wrapper, invalidar } = preparar()
    const a = renderHook(() => personas.useGuardarPersona(), { wrapper })
    const b = renderHook(() => ceremonias.useEliminarCeremonia(), { wrapper })
    const c = renderHook(() => configuracion.useGuardarConfiguracion(), { wrapper })
    const d = renderHook(() => configuracion.useImportarPlan(), { wrapper })
    await act(() => a.result.current.mutateAsync({ datos: {}, clienteIds: [] }))
    await act(() => b.result.current.mutateAsync(5))
    await act(() => c.result.current.mutateAsync({ clave: 'po_nombre', valor: 'Ana' }))
    await act(() => d.result.current.mutateAsync({ filas: [], simular: true }))
    expect(apiConfig.guardarConfiguracion).toHaveBeenCalledWith('po_nombre', 'Ana')
    expect(apiConfig.importarPlan).toHaveBeenCalledWith([], true)
    expect(clavesInvalidadas(invalidar)).toEqual(expect.arrayContaining(['personas', 'ceremonias', 'alertas', 'config', 'notas']))
  })

  it('useCambiarModoEnvio invalida correo y auditoría; probar y prueba no invalidan', async () => {
    apiCorreo.cambiarModoEnvio.mockResolvedValue({})
    apiCorreo.probarConexionCorreo.mockResolvedValue({ ok: true })
    const { wrapper, invalidar } = preparar()
    const a = renderHook(() => correo.useCambiarModoEnvio(), { wrapper })
    const b = renderHook(() => correo.useProbarConexion(), { wrapper })
    await act(() => b.result.current.mutateAsync())
    expect(invalidar).not.toHaveBeenCalled()
    await act(() => a.result.current.mutateAsync(false))
    expect(clavesInvalidadas(invalidar)).toEqual(['correo', 'auditoria'])
  })
})
