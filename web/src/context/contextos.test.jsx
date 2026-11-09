import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { auth } = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
}))
vi.mock('../lib/supabase', () => ({ supabase: { auth } }))

const { AuthProvider, useAuth } = await import('./AuthContext')
const { ToastProvider, useToast } = await import('./ToastContext')

afterEach(() => vi.useRealTimers())

describe('ToastProvider', () => {
  function Disparador({ texto, tono }) {
    const notificar = useToast()
    return <button onClick={() => notificar(texto, tono)}>Notificar</button>
  }

  it('muestra el mensaje y lo retira tras la duración', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Disparador texto="Guardado" />
      </ToastProvider>,
    )
    act(() => screen.getByText('Notificar').click())
    expect(screen.getByText('Guardado')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(4400))
    expect(screen.getByText('Guardado')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(200))
    expect(screen.queryByText('Guardado')).not.toBeInTheDocument()
  })

  it('apila varios mensajes y usa el tono indicado', () => {
    render(
      <ToastProvider>
        <Disparador texto="Falló" tono="error" />
      </ToastProvider>,
    )
    act(() => screen.getByText('Notificar').click())
    act(() => screen.getByText('Notificar').click())
    expect(screen.getAllByText('Falló')).toHaveLength(2)
    expect(screen.getAllByRole('alert')[0]).toHaveClass('text-danger-ink')
  })

  it('useToast fuera del proveedor lanza un error claro', () => {
    const silenciar = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useToast())).toThrow('useToast debe usarse dentro de ToastProvider')
    silenciar.mockRestore()
  })
})

describe('AuthProvider', () => {
  const darcancelar = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: darcancelar } } })
  })

  const envolver = ({ children }) => <AuthProvider>{children}</AuthProvider>

  it('carga la sesión existente y deja de cargar', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const { result } = renderHook(() => useAuth(), { wrapper: envolver })
    expect(result.current.cargando).toBe(true)
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.sesion.user.id).toBe('u1')
  })

  it('sin sesión deja sesion en null', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } })
    const { result } = renderHook(() => useAuth(), { wrapper: envolver })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.sesion).toBeNull()
  })

  it('reacciona a cambios de sesión y se desuscribe al desmontar', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } })
    const { result, unmount } = renderHook(() => useAuth(), { wrapper: envolver })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    act(() => auth.onAuthStateChange.mock.calls[0][0]('SIGNED_IN', { user: { id: 'u2' } }))
    expect(result.current.sesion.user.id).toBe('u2')
    unmount()
    expect(darcancelar).toHaveBeenCalled()
  })

  it('iniciarSesion envía correo y contraseña', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } })
    auth.signInWithPassword.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper: envolver })
    await act(() => result.current.iniciarSesion('a@b.co', 'secreto'))
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'secreto' })
  })

  it.each([
    [{ code: 'invalid_credentials', message: 'x' }, 'Correo o contraseña incorrectos.'],
    [{ code: 'email_not_confirmed', message: 'x' }, /no está confirmado/],
    [{ code: 'otro', message: 'Failed to fetch' }, 'Failed to fetch'],
  ])('iniciarSesion traduce el error %j', async (error, mensaje) => {
    auth.getSession.mockResolvedValue({ data: { session: null } })
    auth.signInWithPassword.mockResolvedValue({ error })
    const { result } = renderHook(() => useAuth(), { wrapper: envolver })
    await act(async () => {
      await expect(result.current.iniciarSesion('a@b.co', 'x')).rejects.toThrow(mensaje)
    })
  })

  it('cerrarSesion llama a signOut', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } })
    auth.signOut.mockResolvedValue({})
    const { result } = renderHook(() => useAuth(), { wrapper: envolver })
    await act(() => result.current.cerrarSesion())
    expect(auth.signOut).toHaveBeenCalled()
  })

  it('useAuth fuera del proveedor lanza un error claro', () => {
    const silenciar = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow('useAuth debe usarse dentro de AuthProvider')
    silenciar.mockRestore()
  })
})
