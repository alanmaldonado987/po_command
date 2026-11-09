import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ESTADOS } from '../../lib/constantes'
import * as api from '../../test/apiFalsa'
import { argumentoDe } from '../../test/ayudas'
import { renderizar } from '../../test/renderizar'
import { TarjetaEstados } from './TarjetaEstados'

vi.mock('../../api/clickup', async () => (await import('../../test/apiFalsa')).clickup)

const usuario = userEvent.setup({ delay: null })
const EQUIPO = { id: 't1', nombre: 'Ises' }

const MAPEO_COMPLETO = {
  'No iniciado': 'PENDIENTE',
  'En curso': 'EN DESARROLLO',
  'Terminado, en etapa de pruebas': 'VALIDACIÓN',
  Terminado: 'ENTREGADO',
  Suspendido: 'CERRADO',
}

const estado = (cambios = {}) => ({ ...api.ESTADO_CLICKUP_BASE, equipo: EQUIPO, ...cambios })

beforeEach(() => api.reiniciarApiFalsa())

describe('TarjetaEstados', () => {
  it('sin equipo pide elegirlo y no muestra el formulario', () => {
    renderizar(<TarjetaEstados estado={estado({ equipo: null })} />)
    expect(screen.getByText(/Elige un equipo en la tarjeta de conexión/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar mapeo' })).not.toBeInTheDocument()
  })

  it('muestra un selector por cada estado de la app', async () => {
    renderizar(<TarjetaEstados estado={estado()} />)
    for (const nombre of ESTADOS) expect(await screen.findByLabelText(nombre)).toBeInTheDocument()
  })

  it('sin destinos ofrece los estados de todas las listas', async () => {
    renderizar(<TarjetaEstados estado={estado()} />)
    const selector = await screen.findByLabelText('En curso')
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'VALIDACIÓN' })).toBeInTheDocument())
    expect(within(selector).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Elige el estado de ClickUp', 'PENDIENTE', 'EN DESARROLLO', 'VALIDACIÓN', 'ENTREGADO', 'CERRADO',
    ])
  })

  it('con destinos solo ofrece los estados de las listas elegidas', async () => {
    const jerarquia = structuredClone(api.JERARQUIA_CLICKUP)
    jerarquia.espacios[0].carpetas[0].listas[0].estados = ['TO DO', 'DOING']
    api.clickup.obtenerJerarquiaClickUp.mockResolvedValue(jerarquia)
    api.clickup.listarDestinos.mockResolvedValue([{ id: 1, cliente_id: null, lista_id: 'l1', lista_nombre: 'AIR-E' }])
    renderizar(<TarjetaEstados estado={estado()} />)
    const selector = await screen.findByLabelText('En curso')
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'DOING' })).toBeInTheDocument())
    expect(within(selector).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Elige el estado de ClickUp', 'TO DO', 'DOING',
    ])
  })

  it('Guardar mapeo permanece deshabilitado hasta completar los cinco estados', async () => {
    renderizar(<TarjetaEstados estado={estado()} />)
    const guardar = await screen.findByRole('button', { name: 'Guardar mapeo' })
    expect(guardar).toBeDisabled()
    expect(screen.getByText(/Asigna un estado de ClickUp a cada estado de la app/)).toBeInTheDocument()

    const pares = Object.entries(MAPEO_COMPLETO)
    for (const [estadoApp, estadoClickUp] of pares) {
      const selector = screen.getByLabelText(estadoApp)
      await waitFor(() => expect(within(selector).getByRole('option', { name: estadoClickUp })).toBeInTheDocument())
      await usuario.selectOptions(selector, estadoClickUp)
    }
    expect(guardar).toBeEnabled()
  })

  it('guarda el mapeo completo y avisa', async () => {
    renderizar(<TarjetaEstados estado={estado({ mapeo_estados: MAPEO_COMPLETO })} />)
    await usuario.click(await screen.findByRole('button', { name: 'Guardar mapeo' }))
    await waitFor(() => expect(api.clickup.guardarConfigClickUp).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.guardarConfigClickUp)).toEqual({ mapeo_estados: MAPEO_COMPLETO })
    expect(await screen.findByText('Mapeo de estados guardado.')).toBeInTheDocument()
  })

  it('conserva en las opciones un estado guardado que ya no existe en las listas', async () => {
    renderizar(<TarjetaEstados estado={estado({ mapeo_estados: { ...MAPEO_COMPLETO, 'En curso': 'DOING VIEJO' } })} />)
    const selector = await screen.findByLabelText('En curso')
    expect(selector).toHaveValue('DOING VIEJO')
  })

  it('si guardar falla muestra el error', async () => {
    api.clickup.guardarConfigClickUp.mockRejectedValue(new Error('sin permisos'))
    renderizar(<TarjetaEstados estado={estado({ mapeo_estados: MAPEO_COMPLETO })} />)
    await usuario.click(await screen.findByRole('button', { name: 'Guardar mapeo' }))
    expect(await screen.findByText('sin permisos')).toBeInTheDocument()
  })
})
