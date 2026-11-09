import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { argumentoDe } from '../../test/ayudas'
import { renderizar } from '../../test/renderizar'
import { TarjetaConexion } from './TarjetaConexion'

vi.mock('../../api/clickup', async () => (await import('../../test/apiFalsa')).clickup)

const usuario = userEvent.setup({ delay: null })
const EQUIPO = { id: 't1', nombre: 'Ises' }

const estado = (cambios = {}) => ({ ...api.ESTADO_CLICKUP_BASE, ...cambios })

beforeEach(() => api.reiniciarApiFalsa())

describe('TarjetaConexion · token', () => {
  it('sin token guardado pide pk_… y deshabilita Guardar y probar', () => {
    renderizar(<TarjetaConexion estado={estado()} />)
    expect(screen.getByPlaceholderText('pk_…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar y probar' })).toBeDisabled()
  })

  it('con token guardado muestra el marcador y permite probar sin escribir otro', async () => {
    renderizar(<TarjetaConexion estado={estado({ token_configurado: true })} />)
    expect(screen.getByPlaceholderText('•••••••• (guardado)')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Guardar y probar' }))
    await waitFor(() => expect(api.clickup.probarClickUp).toHaveBeenCalledTimes(1))
    expect(api.clickup.guardarConfigClickUp).not.toHaveBeenCalled()
  })

  it('guarda el token recortado, prueba la conexión y limpia el campo', async () => {
    renderizar(<TarjetaConexion estado={estado()} />)
    const campo = screen.getByLabelText(/Token personal de ClickUp/)
    await usuario.type(campo, '  pk_123  ')
    await usuario.click(screen.getByRole('button', { name: 'Guardar y probar' }))
    expect(
      await screen.findByText('Conexión correcta como vero@ises.com.co. Equipos disponibles: 1.'),
    ).toBeInTheDocument()
    expect(argumentoDe(api.clickup.guardarConfigClickUp)).toEqual({ token: 'pk_123' })
    expect(campo).toHaveValue('')
  })

  it('acepta un usuario devuelto como objeto', async () => {
    api.clickup.probarClickUp.mockResolvedValue({ ok: true, usuario: { username: 'vero' }, equipos: [] })
    renderizar(<TarjetaConexion estado={estado({ token_configurado: true })} />)
    await usuario.click(screen.getByRole('button', { name: 'Guardar y probar' }))
    expect(await screen.findByText('Conexión correcta como vero. Equipos disponibles: 0.')).toBeInTheDocument()
  })

  it('si ClickUp rechaza el token lo indica', async () => {
    api.clickup.probarClickUp.mockResolvedValue({ ok: false })
    renderizar(<TarjetaConexion estado={estado({ token_configurado: true })} />)
    await usuario.click(screen.getByRole('button', { name: 'Guardar y probar' }))
    expect(await screen.findByText(/ClickUp rechazó el token/)).toBeInTheDocument()
  })

  it('si la función falla muestra el error', async () => {
    api.clickup.probarClickUp.mockRejectedValue(new Error('sin red'))
    renderizar(<TarjetaConexion estado={estado({ token_configurado: true })} />)
    await usuario.click(screen.getByRole('button', { name: 'Guardar y probar' }))
    expect(await screen.findByText('sin red')).toBeInTheDocument()
  })
})

describe('TarjetaConexion · equipo', () => {
  it('queda deshabilitado mientras no haya token', () => {
    renderizar(<TarjetaConexion estado={estado()} />)
    expect(screen.getByLabelText('Equipo de trabajo')).toBeDisabled()
  })

  it('muestra el equipo ya guardado como única opción', () => {
    renderizar(<TarjetaConexion estado={estado({ token_configurado: true, equipo: EQUIPO })} />)
    const selector = screen.getByLabelText('Equipo de trabajo')
    expect(selector).toHaveValue('t1')
    expect(screen.getByRole('option', { name: 'Ises' })).toBeInTheDocument()
  })

  it('tras probar la conexión ofrece los equipos y guarda el elegido', async () => {
    renderizar(<TarjetaConexion estado={estado({ token_configurado: true })} />)
    await usuario.click(screen.getByRole('button', { name: 'Guardar y probar' }))
    await screen.findByText(/Conexión correcta/)
    await usuario.selectOptions(screen.getByLabelText('Equipo de trabajo'), 'Ises')
    await waitFor(() => expect(api.clickup.guardarConfigClickUp).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.guardarConfigClickUp)).toEqual({ equipo_id: 't1' })
    expect(await screen.findByText('Equipo guardado.')).toBeInTheDocument()
  })
})

describe('TarjetaConexion · sincronización activa', () => {
  it('no se puede activar sin token ni equipo y explica por qué', () => {
    renderizar(<TarjetaConexion estado={estado()} />)
    expect(screen.getByRole('switch', { name: 'Sincronización activa' })).toBeDisabled()
    expect(screen.getByText('Guarda el token y elige un equipo para poder activarla.')).toBeInTheDocument()
  })

  it('pide confirmación y activa al aceptar', async () => {
    renderizar(<TarjetaConexion estado={estado({ token_configurado: true, equipo: EQUIPO })} />)
    await usuario.click(screen.getByRole('switch', { name: 'Sincronización activa' }))
    expect(screen.getByText(/Al activar la sincronización/)).toBeInTheDocument()
    expect(api.clickup.guardarConfigClickUp).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole('button', { name: 'Sí, activar' }))
    await waitFor(() => expect(api.clickup.guardarConfigClickUp).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.guardarConfigClickUp)).toEqual({ habilitado: true })
    expect(await screen.findByText('Sincronización activada.')).toBeInTheDocument()
  })

  it('cancelar descarta el cambio sin guardar', async () => {
    renderizar(<TarjetaConexion estado={estado({ token_configurado: true, equipo: EQUIPO })} />)
    await usuario.click(screen.getByRole('switch', { name: 'Sincronización activa' }))
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText(/Al activar la sincronización/)).not.toBeInTheDocument()
    expect(api.clickup.guardarConfigClickUp).not.toHaveBeenCalled()
  })

  it('al desactivar avisa de que se detiene la sincronización', async () => {
    renderizar(<TarjetaConexion estado={estado({ token_configurado: true, equipo: EQUIPO, habilitado: true })} />)
    await usuario.click(screen.getByRole('switch', { name: 'Sincronización activa' }))
    expect(screen.getByText(/Al desactivarla, los cambios dejan de sincronizarse/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Sí, desactivar' }))
    await waitFor(() => expect(api.clickup.guardarConfigClickUp).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.guardarConfigClickUp)).toEqual({ habilitado: false })
    expect(await screen.findByText('Sincronización desactivada.')).toBeInTheDocument()
  })

  it('si guardar falla muestra el error', async () => {
    api.clickup.guardarConfigClickUp.mockRejectedValue(new Error('sin permisos'))
    renderizar(<TarjetaConexion estado={estado({ token_configurado: true, equipo: EQUIPO })} />)
    await usuario.click(screen.getByRole('switch', { name: 'Sincronización activa' }))
    await usuario.click(screen.getByRole('button', { name: 'Sí, activar' }))
    expect(await screen.findByText('sin permisos')).toBeInTheDocument()
  })
})
