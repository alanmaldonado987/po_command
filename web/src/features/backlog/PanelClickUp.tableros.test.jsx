import { act, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { crearDestino, crearItem } from '../../test/fabricas'
import { renderizar } from '../../test/renderizar'
import { PanelClickUp } from './PanelClickUp'

vi.mock('../../api/clickup', async () => (await import('../../test/apiFalsa')).clickup)

const sincronizacion = (cambios = {}) =>
  api.clickup.obtenerEstadoClickUp.mockResolvedValue({ ...api.ESTADO_CLICKUP_BASE, habilitado: true, ...cambios })

const sinVincular = (extra = {}) =>
  crearItem({ id: 5, responsable_id: 3, tablero_id: 1, tablero: 'Desarrollo', cliente_id: 2, cliente: 'AIR-E', ...extra })

const asentar = () => act(() => new Promise((resolver) => setTimeout(resolver, 30)))

beforeEach(() => api.reiniciarApiFalsa())

describe('PanelClickUp · tableros', () => {
  it('muestra el tablero del ítem vinculado', () => {
    renderizar(<PanelClickUp item={sinVincular({ clickup_task_id: 'abc', clickup_url: 'https://app.clickup.com/t/abc' })} />)
    expect(screen.getByText('Desarrollo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir en ClickUp' })).toBeInTheDocument()
  })

  it('avisa cuando el responsable tiene tablero pero ese tablero no tiene destino', async () => {
    sincronizacion()
    renderizar(<PanelClickUp item={sinVincular()} />)
    expect(await screen.findByText(/Sin destino en ClickUp para Desarrollo \/ AIR-E/)).toBeInTheDocument()
  })

  it('un ítem sin tablero lo indica en el aviso', async () => {
    sincronizacion()
    renderizar(<PanelClickUp item={sinVincular({ tablero_id: null, tablero: null, cliente: null, cliente_id: null })} />)
    expect(await screen.findByText(/Sin destino en ClickUp para Sin tablero \/ Sin cliente/)).toBeInTheDocument()
  })

  it('no avisa si el ítem hereda un destino del tablero o por defecto', async () => {
    sincronizacion()
    api.clickup.listarDestinos.mockResolvedValue([crearDestino({ id: 1, tablero_id: null, cliente_id: null })])
    renderizar(<PanelClickUp item={sinVincular()} />)
    await waitFor(() => expect(api.clickup.listarDestinos).toHaveBeenCalled())
    await waitFor(() => expect(api.clickup.obtenerEstadoClickUp).toHaveBeenCalled())
    await asentar()
    expect(screen.queryByRole('heading', { name: 'ClickUp' })).not.toBeInTheDocument()
  })

  it('no avisa si el ítem no tiene responsable', async () => {
    sincronizacion()
    renderizar(<PanelClickUp item={sinVincular({ responsable_id: null })} />)
    await waitFor(() => expect(api.clickup.obtenerEstadoClickUp).toHaveBeenCalled())
    await asentar()
    expect(screen.queryByRole('heading', { name: 'ClickUp' })).not.toBeInTheDocument()
  })

  it('no avisa con la sincronización desactivada', async () => {
    renderizar(<PanelClickUp item={sinVincular()} />)
    await waitFor(() => expect(api.clickup.obtenerEstadoClickUp).toHaveBeenCalled())
    await asentar()
    expect(screen.queryByRole('heading', { name: 'ClickUp' })).not.toBeInTheDocument()
  })

  it('un ítem vinculado también avisa si perdió su destino', async () => {
    sincronizacion()
    renderizar(<PanelClickUp item={sinVincular({ clickup_task_id: 'abc', clickup_url: null })} />)
    expect(await screen.findByText(/Sin destino en ClickUp para Desarrollo \/ AIR-E/)).toBeInTheDocument()
  })

  it('describe el cambio de tablero pendiente', async () => {
    api.clickup.listarPendientesDeItem.mockResolvedValue([{ id: 1, accion: 'mover' }])
    renderizar(<PanelClickUp item={sinVincular({ clickup_task_id: 'abc', clickup_url: null })} />)
    expect(await screen.findByText('Sincronización pendiente: cambio de tablero.')).toBeInTheDocument()
  })
})
