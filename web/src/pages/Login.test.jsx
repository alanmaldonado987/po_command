import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderizar } from '../test/renderizar'
import Login from './Login'

const { auth } = vi.hoisted(() => ({ auth: { sesion: null, iniciarSesion: vi.fn() } }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))

const usuario = userEvent.setup({ delay: null })

const pantalla = () =>
  renderizar(
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<p>Panel principal</p>} />
    </Routes>,
    { ruta: '/login' },
  )

beforeEach(() => {
  auth.sesion = null
  auth.iniciarSesion.mockReset()
})

describe('Login', () => {
  it('muestra el formulario', () => {
    pantalla()
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
  })

  it('envía el correo sin espacios y la contraseña', async () => {
    auth.iniciarSesion.mockResolvedValue()
    pantalla()
    await usuario.type(screen.getByLabelText('Correo'), '  vero@ises.com.co ')
    await usuario.type(screen.getByLabelText('Contraseña'), 'secreto1')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(auth.iniciarSesion).toHaveBeenCalledWith('vero@ises.com.co', 'secreto1'))
  })

  it('muestra el error devuelto y vuelve a habilitar el botón', async () => {
    auth.iniciarSesion.mockRejectedValue(new Error('Correo o contraseña incorrectos.'))
    pantalla()
    await usuario.type(screen.getByLabelText('Correo'), 'a@b.co')
    await usuario.type(screen.getByLabelText('Contraseña'), 'mala')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })

  it('con sesión activa redirige al panel', () => {
    auth.sesion = { user: { id: 'u1' } }
    pantalla()
    expect(screen.getByText('Panel principal')).toBeInTheDocument()
  })
})
