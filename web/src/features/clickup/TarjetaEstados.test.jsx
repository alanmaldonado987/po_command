import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ESTADOS } from '../../lib/constantes'
import * as api from '../../test/apiFalsa'
import { argumentoDe, marcarOpcion } from '../../test/ayudas'
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
    for (const nombre of ESTADOS) expect(await screen.findByRole('button', { name: nombre })).toBeInTheDocument()
  })

  it('sin destinos ofrece los estados de todas las listas', async () => {
    renderizar(<TarjetaEstados estado={estado()} />)
    await usuario.click(await screen.findByRole('button', { name: 'En curso' }))
    expect(screen.getAllByRole('checkbox').map((casilla) => casilla.closest('label').textContent)).toEqual([
      'PENDIENTE', 'EN DESARROLLO', 'VALIDACIÓN', 'ENTREGADO', 'CERRADO',
    ])
  })

  it('con destinos solo ofrece los estados de las listas elegidas', async () => {
    const jerarquia = structuredClone(api.JERARQUIA_CLICKUP)
    jerarquia.espacios[0].carpetas[0].listas[0].estados = ['TO DO', 'DOING']
    api.clickup.obtenerJerarquiaClickUp.mockResolvedValue(jerarquia)
    api.clickup.listarDestinos.mockResolvedValue([{ id: 1, cliente_id: null, lista_id: 'l1', lista_nombre: 'AIR-E' }])
    renderizar(<TarjetaEstados estado={estado()} />)
    await usuario.click(await screen.findByRole('button', { name: 'En curso' }))
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2))
    expect(screen.getAllByRole('checkbox').map((casilla) => casilla.closest('label').textContent)).toEqual(['TO DO', 'DOING'])
  })

  it('Guardar mapeo permanece deshabilitado hasta completar los cinco estados', async () => {
    renderizar(<TarjetaEstados estado={estado()} />)
    const guardar = await screen.findByRole('button', { name: 'Guardar mapeo' })
    expect(guardar).toBeDisabled()
    expect(screen.getByText(/Asigna un estado de ClickUp a cada estado de la app/)).toBeInTheDocument()

    for (const [estadoApp, estadoClickUp] of Object.entries(MAPEO_COMPLETO)) {
      await marcarOpcion(usuario, estadoApp, estadoClickUp)
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
    const selector = await screen.findByRole('button', { name: 'En curso' })
    expect(selector).toHaveTextContent('DOING VIEJO')
    await usuario.click(selector)
    expect(screen.getByRole('checkbox', { name: 'DOING VIEJO' })).toBeChecked()
  })

  it('si guardar falla muestra el error', async () => {
    api.clickup.guardarConfigClickUp.mockRejectedValue(new Error('sin permisos'))
    renderizar(<TarjetaEstados estado={estado({ mapeo_estados: MAPEO_COMPLETO })} />)
    await usuario.click(await screen.findByRole('button', { name: 'Guardar mapeo' }))
    expect(await screen.findByText('sin permisos')).toBeInTheDocument()
  })
})

describe('TarjetaEstados · varios estados de ClickUp por estado de la app', () => {
  it('permite elegir varios y marca el primero como el que se envía a ClickUp', async () => {
    renderizar(<TarjetaEstados estado={estado({ mapeo_estados: MAPEO_COMPLETO })} />)
    await screen.findByRole('button', { name: 'Terminado' })
    await marcarOpcion(usuario, 'Terminado', 'CERRADO')
    expect(screen.getByRole('button', { name: 'Terminado' })).toHaveTextContent('ENTREGADO, CERRADO')
    expect(screen.getByText('También se aceptan al leer:')).toBeInTheDocument()
    expect(screen.getAllByText('Se envía a ClickUp')).toHaveLength(5)

    await usuario.click(screen.getByRole('button', { name: 'Guardar mapeo' }))
    await waitFor(() => expect(api.clickup.guardarConfigClickUp).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.guardarConfigClickUp)).toEqual({
      mapeo_estados: { ...MAPEO_COMPLETO, Terminado: ['ENTREGADO', 'CERRADO'] },
    })
  })

  it('Hacer principal cambia el estado que se envía a ClickUp', async () => {
    renderizar(<TarjetaEstados estado={estado({ mapeo_estados: { ...MAPEO_COMPLETO, Terminado: ['ENTREGADO', 'CERRADO'] } })} />)
    await usuario.click(await screen.findByRole('button', { name: 'Hacer principal el estado CERRADO de Terminado' }))
    expect(screen.getByRole('button', { name: 'Terminado' })).toHaveTextContent('CERRADO, ENTREGADO')
    await usuario.click(screen.getByRole('button', { name: 'Guardar mapeo' }))
    await waitFor(() => expect(api.clickup.guardarConfigClickUp).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.guardarConfigClickUp).mapeo_estados.Terminado).toEqual(['CERRADO', 'ENTREGADO'])
  })

  it('al quitar el principal pasa a serlo el siguiente y con uno solo se guarda como texto', async () => {
    renderizar(<TarjetaEstados estado={estado({ mapeo_estados: { ...MAPEO_COMPLETO, Terminado: ['ENTREGADO', 'CERRADO'] } })} />)
    await screen.findByRole('button', { name: 'Terminado' })
    await marcarOpcion(usuario, 'Terminado', 'ENTREGADO')
    expect(screen.getByRole('button', { name: 'Terminado' }).textContent).toMatch(/^CERRADO\s*expand_more$/)
    await usuario.click(screen.getByRole('button', { name: 'Guardar mapeo' }))
    await waitFor(() => expect(api.clickup.guardarConfigClickUp).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.guardarConfigClickUp).mapeo_estados.Terminado).toBe('CERRADO')
  })

  it('un mapeo guardado con varios estados se muestra y se vuelve a guardar igual', async () => {
    const guardado = { ...MAPEO_COMPLETO, 'En curso': ['EN DESARROLLO', 'DOING VIEJO'] }
    renderizar(<TarjetaEstados estado={estado({ mapeo_estados: guardado })} />)
    expect(await screen.findByRole('button', { name: 'En curso' })).toHaveTextContent('EN DESARROLLO, DOING VIEJO')
    await usuario.click(screen.getByRole('button', { name: 'Guardar mapeo' }))
    await waitFor(() => expect(api.clickup.guardarConfigClickUp).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.guardarConfigClickUp)).toEqual({ mapeo_estados: guardado })
  })

  it('sin estados disponibles permite escribirlos separados por coma', async () => {
    api.clickup.obtenerJerarquiaClickUp.mockResolvedValue({ espacios: [] })
    renderizar(<TarjetaEstados estado={estado({ mapeo_estados: MAPEO_COMPLETO })} />)
    const campo = await screen.findByRole('textbox', { name: 'En curso' })
    await usuario.clear(campo)
    await usuario.type(campo, 'Doing, En curso, doing ')
    await usuario.click(screen.getByRole('button', { name: 'Guardar mapeo' }))
    await waitFor(() => expect(api.clickup.guardarConfigClickUp).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.guardarConfigClickUp).mapeo_estados['En curso']).toEqual(['Doing', 'En curso', 'doing'])
  })
})
