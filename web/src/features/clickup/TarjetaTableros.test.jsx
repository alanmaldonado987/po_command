import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { argumentoDe } from '../../test/ayudas'
import { crearDestino, crearPersona, crearTablero } from '../../test/fabricas'
import { renderizar } from '../../test/renderizar'
import { TarjetaTableros } from './TarjetaTableros'

vi.mock('../../api/clickup', async () => (await import('../../test/apiFalsa')).clickup)
vi.mock('../../api/personas', async () => (await import('../../test/apiFalsa')).personas)

const usuario = userEvent.setup({ delay: null })

const desarrollo = crearTablero({ id: 1, nombre: 'Desarrollo' })
const analitica = crearTablero({ id: 2, nombre: 'Analítica', mapeo_estados: { Terminado: 'LISTO' } })

beforeEach(() => {
  api.reiniciarApiFalsa()
  api.clickup.listarTableros.mockResolvedValue([desarrollo, analitica])
  api.personas.listarPersonas.mockResolvedValue([
    crearPersona({ id: 10, tablero_id: 1 }),
    crearPersona({ id: 11, tablero_id: 1 }),
    crearPersona({ id: 12, tablero_id: 2 }),
  ])
  api.clickup.listarDestinos.mockResolvedValue([
    crearDestino({ id: 20, tablero_id: 1, cliente_id: null }),
    crearDestino({ id: 21, tablero_id: 1, cliente_id: 5 }),
  ])
})

describe('TarjetaTableros · listado', () => {
  it('sin tableros explica que se usa el destino por defecto', async () => {
    api.clickup.listarTableros.mockResolvedValue([])
    renderizar(<TarjetaTableros />)
    expect(await screen.findByText(/Aún no hay tableros/)).toBeInTheDocument()
  })

  it('muestra cada tablero con su uso y el tipo de mapeo', async () => {
    renderizar(<TarjetaTableros />)
    const campo = await screen.findByLabelText('Nombre del tablero Desarrollo')
    const fila = campo.closest('div.space-y-3')
    expect(within(fila).getByText('2 persona(s)')).toBeInTheDocument()
    expect(within(fila).getByText('2 destino(s)')).toBeInTheDocument()
    expect(within(fila).getByText('Usa el mapeo general')).toBeInTheDocument()

    const filaAnalitica = screen.getByLabelText('Nombre del tablero Analítica').closest('div.space-y-3')
    expect(within(filaAnalitica).getByText('1 persona(s)')).toBeInTheDocument()
    expect(within(filaAnalitica).getByText('Mapeo de estados propio')).toBeInTheDocument()
  })

  it('si la consulta falla muestra el error', async () => {
    api.clickup.listarTableros.mockRejectedValue(new Error('migración sin aplicar'))
    renderizar(<TarjetaTableros />)
    expect(await screen.findByText(/migración sin aplicar/)).toBeInTheDocument()
  })
})

describe('TarjetaTableros · alta', () => {
  it('Agregar tablero exige un nombre', async () => {
    renderizar(<TarjetaTableros />)
    const agregar = await screen.findByRole('button', { name: 'Agregar tablero' })
    expect(agregar).toBeDisabled()
    await usuario.type(screen.getByLabelText('Nuevo tablero'), '   ')
    expect(agregar).toBeDisabled()
  })

  it('crea el tablero con el nombre recortado, limpia el campo y avisa', async () => {
    renderizar(<TarjetaTableros />)
    const campo = await screen.findByLabelText('Nuevo tablero')
    await usuario.type(campo, '  Soporte  ')
    await usuario.click(screen.getByRole('button', { name: 'Agregar tablero' }))
    await waitFor(() => expect(api.clickup.crearTablero).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.crearTablero)).toEqual({ nombre: 'Soporte' })
    expect(await screen.findByText('Tablero «Soporte» creado.')).toBeInTheDocument()
    expect(campo).toHaveValue('')
  })

  it('si crear falla muestra el error y conserva el nombre', async () => {
    api.clickup.crearTablero.mockRejectedValue(new Error('duplicate key value'))
    renderizar(<TarjetaTableros />)
    const campo = await screen.findByLabelText('Nuevo tablero')
    await usuario.type(campo, 'Desarrollo')
    await usuario.click(screen.getByRole('button', { name: 'Agregar tablero' }))
    expect(await screen.findByText('duplicate key value')).toBeInTheDocument()
    expect(campo).toHaveValue('Desarrollo')
  })
})

describe('TarjetaTableros · renombrar', () => {
  it('Renombrar solo se habilita cuando el nombre cambia', async () => {
    renderizar(<TarjetaTableros />)
    const campo = await screen.findByLabelText('Nombre del tablero Desarrollo')
    const boton = screen.getByRole('button', { name: 'Renombrar tablero Desarrollo' })
    expect(boton).toBeDisabled()
    await usuario.type(campo, ' web')
    expect(boton).toBeEnabled()
  })

  it('guarda el nuevo nombre del tablero', async () => {
    renderizar(<TarjetaTableros />)
    const campo = await screen.findByLabelText('Nombre del tablero Desarrollo')
    await usuario.clear(campo)
    await usuario.type(campo, 'Ingeniería')
    await usuario.click(screen.getByRole('button', { name: 'Renombrar tablero Desarrollo' }))
    await waitFor(() => expect(api.clickup.actualizarTablero).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.actualizarTablero)).toEqual({ id: 1, nombre: 'Ingeniería' })
    expect(await screen.findByText('Tablero renombrado a «Ingeniería».')).toBeInTheDocument()
  })
})

describe('TarjetaTableros · eliminar', () => {
  it('pide confirmación mostrando cuántas personas y destinos lo usan', async () => {
    renderizar(<TarjetaTableros />)
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar tablero Desarrollo' }))
    expect(screen.getByText(/¿Eliminar el tablero «Desarrollo»\? Lo usan 2 persona\(s\) y 2 destino\(s\)/)).toBeInTheDocument()
    expect(api.clickup.eliminarTablero).not.toHaveBeenCalled()
  })

  it('Cancelar cierra la confirmación sin borrar', async () => {
    renderizar(<TarjetaTableros />)
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar tablero Desarrollo' }))
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText(/¿Eliminar el tablero/)).not.toBeInTheDocument()
    expect(api.clickup.eliminarTablero).not.toHaveBeenCalled()
  })

  it('confirmar elimina el tablero y avisa', async () => {
    renderizar(<TarjetaTableros />)
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar tablero Analítica' }))
    await usuario.click(screen.getByRole('button', { name: 'Sí, eliminar' }))
    await waitFor(() => expect(api.clickup.eliminarTablero).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.eliminarTablero)).toBe(2)
    expect(await screen.findByText('Tablero «Analítica» eliminado.')).toBeInTheDocument()
  })

  it('si eliminar falla muestra el error', async () => {
    api.clickup.eliminarTablero.mockRejectedValue(new Error('sin permisos'))
    renderizar(<TarjetaTableros />)
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar tablero Analítica' }))
    await usuario.click(screen.getByRole('button', { name: 'Sí, eliminar' }))
    expect(await screen.findByText('sin permisos')).toBeInTheDocument()
  })
})
