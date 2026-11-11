import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as clickupFalso from '../test/apiFalsa'

vi.mock('../api/clickup', async () => (await import('../test/apiFalsa')).clickup)

const hooks = await import('./useClickUp')
const api = clickupFalso.clickup

function preparar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const invalidar = vi.spyOn(cliente, 'invalidateQueries')
  const wrapper = ({ children }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  return { wrapper, invalidar }
}

const claves = (invalidar) => invalidar.mock.calls.map(([opciones]) => opciones.queryKey[0])

beforeEach(() => clickupFalso.reiniciarApiFalsa())

describe('consultas de ClickUp', () => {
  it('useEstadoClickUp devuelve el estado de la integración', async () => {
    api.obtenerEstadoClickUp.mockResolvedValue({ habilitado: true })
    const { wrapper } = preparar()
    const { result } = renderHook(() => hooks.useEstadoClickUp(), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual({ habilitado: true }))
  })

  it('useEstadoClickUp expone el error de la función', async () => {
    api.obtenerEstadoClickUp.mockRejectedValue(new Error('función no desplegada'))
    const { wrapper } = preparar()
    const { result } = renderHook(() => hooks.useEstadoClickUp(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error.message).toBe('función no desplegada')
  })

  it('useJerarquiaClickUp no consulta sin equipo y sí con él', async () => {
    const { wrapper } = preparar()
    renderHook(() => hooks.useJerarquiaClickUp(null), { wrapper })
    expect(api.obtenerJerarquiaClickUp).not.toHaveBeenCalled()
    renderHook(() => hooks.useJerarquiaClickUp('t1'), { wrapper })
    await waitFor(() => expect(api.obtenerJerarquiaClickUp).toHaveBeenCalledWith('t1'))
  })

  it('useDestinosClickUp lee sus tablas', async () => {
    api.listarDestinos.mockResolvedValue([{ id: 1 }])
    const { wrapper } = preparar()
    const destinos = renderHook(() => hooks.useDestinosClickUp(), { wrapper })
    await waitFor(() => expect(destinos.result.current.data).toEqual([{ id: 1 }]))
  })

  describe('useColaClickUp', () => {
    const fila = (id, estado) => ({ id, estado })

    it('con un filtro pide solo ese estado y avisa si puede haber más', async () => {
      api.listarColaClickUp.mockResolvedValue([fila(3, 'Fallida'), fila(2, 'Fallida')])
      const { wrapper } = preparar()
      const { result } = renderHook(() => hooks.useColaClickUp('errores', 2), { wrapper })
      await waitFor(() => expect(result.current.data).toEqual({ filas: [fila(3, 'Fallida'), fila(2, 'Fallida')], hayMas: true }))
      expect(api.listarColaClickUp).toHaveBeenCalledWith({ estados: ['Fallida'], limite: 2 })
    })

    it('sin filtro pone primero los fallidos y luego los pendientes, y después los enviados', async () => {
      api.listarColaClickUp.mockImplementation(async ({ estados }) =>
        estados.includes('Enviada')
          ? [fila(9, 'Enviada'), fila(8, 'Enviada')]
          : [fila(7, 'Pendiente'), fila(6, 'Fallida'), fila(5, 'Pendiente'), fila(4, 'Fallida')],
      )
      const { wrapper } = preparar()
      const { result } = renderHook(() => hooks.useColaClickUp('todos', 20), { wrapper })
      await waitFor(() => expect(result.current.data).toBeDefined())
      expect(result.current.data.filas.map((f) => f.id)).toEqual([6, 4, 7, 5, 9, 8])
      expect(result.current.data.hayMas).toBe(false)
      expect(api.listarColaClickUp).toHaveBeenCalledWith({ estados: ['Pendiente', 'Fallida'], limite: 100 })
      expect(api.listarColaClickUp).toHaveBeenCalledWith({ estados: ['Enviada'], limite: 20 })
    })
  })

  it('useTablerosClickUp lee los tableros', async () => {
    api.listarTableros.mockResolvedValue([{ id: 1, nombre: 'Desarrollo' }])
    const { wrapper } = preparar()
    const { result } = renderHook(() => hooks.useTablerosClickUp(), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual([{ id: 1, nombre: 'Desarrollo' }]))
  })

  it('usePendientesClickUpDeItem solo consulta con itemId', async () => {
    const { wrapper } = preparar()
    renderHook(() => hooks.usePendientesClickUpDeItem(null), { wrapper })
    expect(api.listarPendientesDeItem).not.toHaveBeenCalled()
    renderHook(() => hooks.usePendientesClickUpDeItem(4), { wrapper })
    await waitFor(() => expect(api.listarPendientesDeItem).toHaveBeenCalledWith(4))
  })
})

describe('mutaciones de ClickUp', () => {
  it.each([
    ['useGuardarConfigClickUp', 'guardarConfigClickUp', { habilitado: true }, ['clickup']],
    ['useProbarClickUp', 'probarClickUp', undefined, ['clickup']],
    ['useGuardarDestino', 'guardarDestino', { clienteId: null, listaId: 'l1', listaNombre: 'AIR-E' }, ['clickup']],
    ['useEliminarDestino', 'eliminarDestino', 3, ['clickup']],
    ['useCrearTablero', 'crearTablero', { nombre: 'Analitica' }, ['clickup']],
    ['useActualizarTablero', 'actualizarTablero', { id: 1, nombre: 'Datos' }, ['clickup']],
    ['useEliminarTablero', 'eliminarTablero', 1, ['clickup', 'personas', 'items']],
    ['useRegistrarWebhook', 'registrarWebhookClickUp', undefined, ['clickup']],
    ['useQuitarWebhook', 'quitarWebhookClickUp', undefined, ['clickup']],
    ['useSincronizarClickUp', 'sincronizarClickUp', undefined, ['clickup', 'items']],
    ['useReconciliarClickUp', 'reconciliarClickUp', undefined, ['clickup', 'items', 'bloqueantes']],
    ['useImportarExistentes', 'importarExistentesClickUp', { listaId: 'l1' }, ['clickup', 'items', 'catalogo', 'personas']],
  ])('%s llama a la API e invalida las consultas dependientes', async (hook, funcion, argumento, esperadas) => {
    const { wrapper, invalidar } = preparar()
    const { result } = renderHook(() => hooks[hook](), { wrapper })
    await act(() => result.current.mutateAsync(argumento))
    expect(api[funcion]).toHaveBeenCalledTimes(1)
    expect(claves(invalidar)).toEqual(esperadas)
  })

  it('una mutación fallida no invalida nada y propaga el error', async () => {
    api.sincronizarClickUp.mockRejectedValue(new Error('límite de ClickUp'))
    const { wrapper, invalidar } = preparar()
    const { result } = renderHook(() => hooks.useSincronizarClickUp(), { wrapper })
    await expect(act(() => result.current.mutateAsync())).rejects.toThrow('límite de ClickUp')
    expect(invalidar).not.toHaveBeenCalled()
  })
})
