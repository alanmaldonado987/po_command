import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { crearItem } from '../../test/fabricas'
import { renderizar } from '../../test/renderizar'
import { TarjetaActividad } from './TarjetaActividad'

vi.mock('../../api/clickup', async () => (await import('../../test/apiFalsa')).clickup)
vi.mock('../../api/items', async () => (await import('../../test/apiFalsa')).items)

const fila = (extra = {}) => ({
  id: 1,
  item_id: 10,
  accion: 'create',
  estado: 'Enviada',
  intentos: 1,
  error: null,
  creado_en: '2026-11-06T15:00:00Z',
  procesado_en: '2026-11-06T15:01:00Z',
  ...extra,
})

beforeEach(() => {
  api.reiniciarApiFalsa()
  api.items.listarItems.mockResolvedValue([crearItem({ id: 10, codigo: 'BL-010' })])
})

describe('TarjetaActividad', () => {
  it('sin envíos muestra el estado vacío', async () => {
    renderizar(<TarjetaActividad />)
    expect(await screen.findByText('Aún no se ha enviado nada a ClickUp.')).toBeInTheDocument()
  })

  it('pide los últimos 15 envíos', async () => {
    renderizar(<TarjetaActividad />)
    await screen.findByText('Aún no se ha enviado nada a ClickUp.')
    expect(api.clickup.listarColaClickUp).toHaveBeenCalledWith(15)
  })

  it('lista cada envío con el código del ítem, la acción y el estado', async () => {
    api.clickup.listarColaClickUp.mockResolvedValue([
      fila({ id: 1, accion: 'create' }),
      fila({ id: 2, accion: 'update', estado: 'Pendiente', procesado_en: null }),
      fila({ id: 3, accion: 'archive', intentos: 2 }),
    ])
    renderizar(<TarjetaActividad />)
    expect(await screen.findByText('BL-010 · Crear')).toBeInTheDocument()
    expect(screen.getByText('BL-010 · Actualizar')).toBeInTheDocument()
    expect(screen.getByText('BL-010 · Archivar')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByText('Intentos: 2')).toBeInTheDocument()
  })

  it('un envío fallido muestra su error', async () => {
    api.clickup.listarColaClickUp.mockResolvedValue([fila({ estado: 'Fallida', error: 'Estado no válido en la lista', intentos: 3 })])
    renderizar(<TarjetaActividad />)
    expect(await screen.findByText('Estado no válido en la lista')).toBeInTheDocument()
    expect(screen.getByText('Fallida')).toBeInTheDocument()
  })

  it('si el ítem ya no está en la lista usa su identificador', async () => {
    api.clickup.listarColaClickUp.mockResolvedValue([fila({ item_id: 77 })])
    renderizar(<TarjetaActividad />)
    expect(await screen.findByText('Ítem 77 · Crear')).toBeInTheDocument()
  })

  it('la acción de cambio de tablero se muestra como «Mover»', async () => {
    api.clickup.listarColaClickUp.mockResolvedValue([fila({ accion: 'mover' })])
    renderizar(<TarjetaActividad />)
    expect(await screen.findByText('BL-010 · Mover')).toBeInTheDocument()
  })

  it('una acción desconocida se muestra tal cual', async () => {
    api.clickup.listarColaClickUp.mockResolvedValue([fila({ accion: 'reindexar' })])
    renderizar(<TarjetaActividad />)
    expect(await screen.findByText('BL-010 · reindexar')).toBeInTheDocument()
  })

  it('si la consulta falla muestra el error', async () => {
    api.clickup.listarColaClickUp.mockRejectedValue(new Error('sin permisos'))
    renderizar(<TarjetaActividad />)
    expect(await screen.findByText(/sin permisos/)).toBeInTheDocument()
  })
})
