import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { crearItem } from '../../test/fabricas'
import { renderizar } from '../../test/renderizar'
import { PanelClickUp } from './PanelClickUp'

vi.mock('../../api/clickup', async () => (await import('../../test/apiFalsa')).clickup)

const vinculado = (extra = {}) =>
  crearItem({ id: 5, clickup_task_id: 'abc123', clickup_url: 'https://app.clickup.com/t/abc123', ...extra })

beforeEach(() => api.reiniciarApiFalsa())

describe('PanelClickUp', () => {
  it('no se muestra para un ítem sin vincular y no consulta pendientes', () => {
    renderizar(<PanelClickUp item={crearItem({ id: 5 })} />)
    expect(screen.queryByRole('heading', { name: 'ClickUp' })).not.toBeInTheDocument()
    expect(api.clickup.listarPendientesDeItem).not.toHaveBeenCalled()
  })

  it('enlaza a la tarea en ClickUp en una pestaña nueva y segura', () => {
    renderizar(<PanelClickUp item={vinculado()} />)
    const enlace = screen.getByRole('link', { name: 'Abrir en ClickUp' })
    expect(enlace).toHaveAttribute('href', 'https://app.clickup.com/t/abc123')
    expect(enlace).toHaveAttribute('target', '_blank')
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('muestra la prioridad del ítem cuando la tiene', () => {
    renderizar(<PanelClickUp item={vinculado({ prioridad: 'Alta' })} />)
    expect(screen.getByText('Alta')).toBeInTheDocument()
  })

  it('sin URL conocida no muestra el enlace', () => {
    renderizar(<PanelClickUp item={vinculado({ clickup_url: null })} />)
    expect(screen.getByRole('heading', { name: 'ClickUp' })).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('consulta los envíos pendientes del ítem', async () => {
    renderizar(<PanelClickUp item={vinculado()} />)
    await screen.findByRole('heading', { name: 'ClickUp' })
    expect(api.clickup.listarPendientesDeItem).toHaveBeenCalledWith(5)
  })

  it('avisa de la sincronización pendiente con el tipo de cambio', async () => {
    api.clickup.listarPendientesDeItem.mockResolvedValue([{ id: 1, accion: 'update' }, { id: 2, accion: 'archive' }])
    renderizar(<PanelClickUp item={vinculado()} />)
    expect(await screen.findByText('Sincronización pendiente: actualización, archivado.')).toBeInTheDocument()
  })

  it('sin pendientes no muestra el aviso', async () => {
    renderizar(<PanelClickUp item={vinculado()} />)
    await screen.findByRole('link', { name: 'Abrir en ClickUp' })
    expect(screen.queryByText(/Sincronización pendiente/)).not.toBeInTheDocument()
  })
})
