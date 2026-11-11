import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { renderizar } from '../../test/renderizar'
import { PestanaClickUp } from './PestanaClickUp'

vi.mock('../../api/clickup', async () => (await import('../../test/apiFalsa')).clickup)
vi.mock('../../api/catalogos', async () => (await import('../../test/apiFalsa')).catalogos)
vi.mock('../../api/items', async () => (await import('../../test/apiFalsa')).items)

const usuario = userEvent.setup({ delay: null })
const EQUIPO = { id: 't1', nombre: 'Ises' }

beforeEach(() => api.reiniciarApiFalsa())

const abrirConEstado = (cambios) => {
  api.clickup.obtenerEstadoClickUp.mockResolvedValue({ ...api.ESTADO_CLICKUP_BASE, ...cambios })
  return renderizar(<PestanaClickUp />)
}

describe('PestanaClickUp', () => {
  it('muestra el estado de carga', () => {
    api.clickup.obtenerEstadoClickUp.mockReturnValue(new Promise(() => {}))
    renderizar(<PestanaClickUp />)
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })

  it('si no se puede leer el estado muestra el error', async () => {
    api.clickup.obtenerEstadoClickUp.mockRejectedValue(new Error('función no desplegada'))
    renderizar(<PestanaClickUp />)
    expect(await screen.findByText(/función no desplegada/)).toBeInTheDocument()
  })

  it('muestra todas las tarjetas', async () => {
    abrirConEstado({})
    for (const titulo of ['Conexión', 'Webhook y estado', 'Tableros', 'Destinos', 'Estados', 'Cola de envíos']) {
      expect(await screen.findByRole('heading', { name: titulo })).toBeInTheDocument()
    }
  })

  it.each([
    ['sin token', {}, /Guarda tu token personal de ClickUp/],
    ['con token pero sin equipo', { token_configurado: true }, /Elige el equipo de trabajo/],
    ['con equipo pero desactivada', { token_configurado: true, equipo: EQUIPO }, /Configura los destinos y el mapeo de estados/],
  ])('guía el siguiente paso %s', async (_caso, cambios, texto) => {
    abrirConEstado(cambios)
    const guia = await screen.findByText(/La sincronización con ClickUp está desactivada\./)
    expect(guia).toHaveTextContent(texto)
  })

  it('avisa de los ítems abiertos sin destino con un enlace a los destinos', async () => {
    abrirConEstado({ token_configurado: true, equipo: EQUIPO, habilitado: true, sin_destino: 4 })
    expect(await screen.findByText(/4 ítem\(s\) abiertos no tienen destino en ClickUp/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Corregir destinos' })).toHaveAttribute('href', '#destinos-clickup')
    expect(document.getElementById('destinos-clickup')).toContainElement(screen.getByRole('heading', { name: 'Destinos' }))
  })

  it('sin ítems sin destino no muestra el aviso', async () => {
    abrirConEstado({ token_configurado: true, equipo: EQUIPO, habilitado: true, sin_destino: 0 })
    await screen.findByRole('heading', { name: 'Destinos' })
    expect(screen.queryByText(/no tienen destino en ClickUp/)).not.toBeInTheDocument()
  })

  it('al pulsar «Con error» la cola se filtra a los fallidos', async () => {
    abrirConEstado({ token_configurado: true, equipo: EQUIPO, habilitado: true, con_error: 3 })
    await usuario.click(await screen.findByRole('button', { name: 'Con error: 3. Ver detalle' }))
    expect(screen.getByRole('button', { name: 'Con error · 3' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('No hay envíos con error.')).toBeInTheDocument()
    expect(api.clickup.listarColaClickUp).toHaveBeenCalledWith({ estados: ['Fallida'], limite: 20 })
  })

  it('al pulsar «Pendientes» la cola se filtra a los pendientes', async () => {
    abrirConEstado({ token_configurado: true, equipo: EQUIPO, habilitado: true, pendientes: 5 })
    await usuario.click(await screen.findByRole('button', { name: 'Pendientes: 5. Ver detalle' }))
    expect(screen.getByRole('button', { name: 'Pendientes · 5' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('con la sincronización activa no muestra la guía', async () => {
    abrirConEstado({ token_configurado: true, equipo: EQUIPO, habilitado: true, conectado: true })
    await screen.findByRole('heading', { name: 'Conexión' })
    expect(screen.queryByText(/La sincronización con ClickUp está desactivada/)).not.toBeInTheDocument()
  })
})
