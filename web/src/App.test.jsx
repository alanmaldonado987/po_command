import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as api from './test/apiFalsa'
import { crearItem } from './test/fabricas'
import { renderizar } from './test/renderizar'

const { auth } = vi.hoisted(() => ({ auth: { sesion: null, cargando: false, cerrarSesion: vi.fn(), iniciarSesion: vi.fn() } }))
vi.mock('./context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('./api/items', async () => (await import('./test/apiFalsa')).items)
vi.mock('./api/alertas', async () => (await import('./test/apiFalsa')).alertas)
vi.mock('./api/correo', async () => (await import('./test/apiFalsa')).correo)
vi.mock('./routes', () => {
  const Inicio = () => <p>Página de inicio</p>
  const Backlog = () => <p>Página de backlog</p>
  const rutas = [
    { ruta: '/', titulo: 'Centro de Mando', icono: 'space_dashboard', pagina: Inicio },
    { ruta: '/backlog', titulo: 'Backlog · Plan de Trabajo', icono: 'list_alt', pagina: Backlog },
  ]
  return { SECCIONES: [{ titulo: 'Operación', rutas }], RUTAS: rutas }
})

beforeEach(() => {
  api.reiniciarApiFalsa()
  auth.sesion = null
  auth.cargando = false
  auth.cerrarSesion.mockReset()
})

describe('App · rutas protegidas', () => {
  it('sin sesión redirige al login', () => {
    renderizar(<App />, { ruta: '/backlog' })
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('mientras carga la sesión muestra el estado de carga', () => {
    auth.cargando = true
    renderizar(<App />)
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Iniciar sesión' })).not.toBeInTheDocument()
  })

  it('con sesión muestra la página y la navegación', async () => {
    auth.sesion = { user: { id: 'u1' } }
    renderizar(<App />, { ruta: '/backlog' })
    expect(await screen.findByText('Página de backlog')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Centro de Mando/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Backlog · Plan de Trabajo/ })).toHaveAttribute('href', '/backlog')
  })

  it('una ruta desconocida vuelve al inicio', async () => {
    auth.sesion = { user: { id: 'u1' } }
    renderizar(<App />, { ruta: '/no-existe' })
    expect(await screen.findByText('Página de inicio')).toBeInTheDocument()
  })

  it('navega entre páginas desde el menú', async () => {
    auth.sesion = { user: { id: 'u1' } }
    renderizar(<App />)
    await userEvent.click(await screen.findByRole('link', { name: /Backlog · Plan de Trabajo/ }))
    expect(await screen.findByText('Página de backlog')).toBeInTheDocument()
  })

  it('Cerrar sesión llama al contexto', async () => {
    auth.sesion = { user: { id: 'u1' } }
    renderizar(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /Cerrar sesión/ }))
    expect(auth.cerrarSesion).toHaveBeenCalled()
  })

  it('el panel lateral resume ítems abiertos, atrasados y el estado del correo', async () => {
    auth.sesion = { user: { id: 'u1' } }
    api.items.listarItems.mockResolvedValue([
      crearItem({ atrasado: true }),
      crearItem({ estado: 'Terminado' }),
      crearItem(),
    ])
    api.alertas.contarAlertas.mockResolvedValue({ pendientes: 4, fallidas: 0, enviadasHoy: 0 })
    renderizar(<App />)
    expect(await screen.findByText('Simulación')).toBeInTheDocument()
    expect(screen.getByText('Plan de Trabajo · 3 ítems')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })
})
