import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { argumentoDe, marcarOpcion } from '../../test/ayudas'
import { crearDestino, crearTablero } from '../../test/fabricas'
import { renderizar } from '../../test/renderizar'
import { TarjetaEstados } from './TarjetaEstados'

vi.mock('../../api/clickup', async () => (await import('../../test/apiFalsa')).clickup)

const usuario = userEvent.setup({ delay: null })
const EQUIPO = { id: 't1', nombre: 'Ises' }

const GENERAL = {
  'No iniciado': 'PENDIENTE',
  'En curso': 'EN DESARROLLO',
  'Terminado, en etapa de pruebas': 'VALIDACIÓN',
  Terminado: 'ENTREGADO',
  Suspendido: 'CERRADO',
}
const PROPIO = { ...GENERAL, Terminado: 'LISTO', 'En curso': 'DOING' }

const estado = () => ({ ...api.ESTADO_CLICKUP_BASE, equipo: EQUIPO, mapeo_estados: GENERAL })

beforeEach(() => {
  api.reiniciarApiFalsa()
  api.clickup.listarTableros.mockResolvedValue([
    crearTablero({ id: 1, nombre: 'Desarrollo' }),
    crearTablero({ id: 2, nombre: 'Analítica', mapeo_estados: PROPIO }),
  ])
})

describe('TarjetaEstados · tableros', () => {
  it('sin tableros no ofrece el selector de ámbito', async () => {
    api.clickup.listarTableros.mockResolvedValue([])
    renderizar(<TarjetaEstados estado={estado()} />)
    await screen.findByRole('button', { name: 'Guardar mapeo' })
    expect(screen.queryByRole('button', { name: 'General' })).not.toBeInTheDocument()
  })

  it('con tableros ofrece General y cada tablero, empezando por el general', async () => {
    renderizar(<TarjetaEstados estado={estado()} />)
    expect(await screen.findByRole('button', { name: 'General' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Desarrollo' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Analítica' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Terminado' })).toHaveTextContent('ENTREGADO')
  })

  it('un tablero con mapeo propio muestra sus valores y permite volver al general', async () => {
    renderizar(<TarjetaEstados estado={estado()} />)
    await usuario.click(await screen.findByRole('button', { name: 'Analítica' }))
    expect(await screen.findByRole('button', { name: 'Terminado' })).toHaveTextContent('LISTO')
    expect(screen.getByRole('button', { name: 'En curso' })).toHaveTextContent('DOING')
    expect(screen.queryByText(/Este tablero usa el mapeo general/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Usar el mapeo general' })).toBeInTheDocument()
  })

  it('un tablero sin mapeo propio parte del general y lo explica', async () => {
    renderizar(<TarjetaEstados estado={estado()} />)
    await usuario.click(await screen.findByRole('button', { name: 'Desarrollo' }))
    expect(screen.getByText(/Este tablero usa el mapeo general/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Terminado' })).toHaveTextContent('ENTREGADO')
    expect(screen.queryByRole('button', { name: 'Usar el mapeo general' })).not.toBeInTheDocument()
  })

  it('guardar en un tablero crea su mapeo propio sin tocar el general', async () => {
    renderizar(<TarjetaEstados estado={estado()} />)
    await usuario.click(await screen.findByRole('button', { name: 'Desarrollo' }))
    await screen.findByRole('button', { name: 'Terminado' })
    await marcarOpcion(usuario, 'Terminado', 'CERRADO')
    await usuario.click(screen.getByRole('button', { name: 'Guardar mapeo' }))
    await waitFor(() => expect(api.clickup.actualizarTablero).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.actualizarTablero)).toEqual({ id: 1, mapeoEstados: { ...GENERAL, Terminado: ['ENTREGADO', 'CERRADO'] } })
    expect(api.clickup.guardarConfigClickUp).not.toHaveBeenCalled()
    expect(await screen.findByText('Mapeo del tablero Desarrollo guardado.')).toBeInTheDocument()
  })

  it('guardar en General sigue usando la configuración global', async () => {
    renderizar(<TarjetaEstados estado={estado()} />)
    await usuario.click(await screen.findByRole('button', { name: 'Guardar mapeo' }))
    await waitFor(() => expect(api.clickup.guardarConfigClickUp).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.guardarConfigClickUp)).toEqual({ mapeo_estados: GENERAL })
    expect(api.clickup.actualizarTablero).not.toHaveBeenCalled()
  })

  it('Usar el mapeo general borra el mapeo propio del tablero', async () => {
    renderizar(<TarjetaEstados estado={estado()} />)
    await usuario.click(await screen.findByRole('button', { name: 'Analítica' }))
    await usuario.click(screen.getByRole('button', { name: 'Usar el mapeo general' }))
    await waitFor(() => expect(api.clickup.actualizarTablero).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.actualizarTablero)).toEqual({ id: 2, mapeoEstados: null })
    expect(await screen.findByText('El tablero Analítica usa ahora el mapeo general.')).toBeInTheDocument()
  })

  it('ofrece solo los estados de las listas destino del tablero elegido', async () => {
    const jerarquia = structuredClone(api.JERARQUIA_CLICKUP)
    jerarquia.espacios[0].carpetas[0].listas[1].estados = ['ABIERTA', 'CERRADA']
    api.clickup.obtenerJerarquiaClickUp.mockResolvedValue(jerarquia)
    api.clickup.listarDestinos.mockResolvedValue([
      crearDestino({ id: 1, tablero_id: 1, lista_id: 'l1' }),
      crearDestino({ id: 2, tablero_id: 2, lista_id: 'l2' }),
    ])
    renderizar(<TarjetaEstados estado={estado()} />)
    await usuario.click(await screen.findByRole('button', { name: 'Analítica' }))
    await usuario.click(await screen.findByRole('button', { name: 'No iniciado' }))
    expect(screen.getByRole('checkbox', { name: 'ABIERTA' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'CERRADA' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'EN DESARROLLO' })).not.toBeInTheDocument()
  })

  it('si guardar el mapeo de un tablero falla muestra el error', async () => {
    api.clickup.actualizarTablero.mockRejectedValue(new Error('sin permisos'))
    renderizar(<TarjetaEstados estado={estado()} />)
    await usuario.click(await screen.findByRole('button', { name: 'Analítica' }))
    await usuario.click(screen.getByRole('button', { name: 'Guardar mapeo' }))
    expect(await screen.findByText('sin permisos')).toBeInTheDocument()
  })
})
