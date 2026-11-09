import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../test/apiFalsa'
import { argumentoDe } from '../test/ayudas'
import { crearItem, crearPersona, crearTablero } from '../test/fabricas'
import { renderizar } from '../test/renderizar'
import Equipo from './Equipo'

vi.mock('../api/items', async () => (await import('../test/apiFalsa')).items)
vi.mock('../api/catalogos', async () => (await import('../test/apiFalsa')).catalogos)
vi.mock('../api/personas', async () => (await import('../test/apiFalsa')).personas)
vi.mock('../api/clickup', async () => (await import('../test/apiFalsa')).clickup)

const usuario = userEvent.setup({ delay: null })

const ana = crearPersona({ id: 1, nombre: 'Ana Gómez', tipo: 'equipo', tablero_id: 1, tablero: 'Desarrollo' })
const beto = crearPersona({ id: 2, nombre: 'Beto Ruiz', tipo: 'equipo' })
const carla = crearPersona({ id: 3, nombre: 'Carla Soto', tipo: 'stakeholder', frecuencia_reporte: 'Mensual' })

beforeEach(() => {
  api.reiniciarApiFalsa()
  api.personas.listarPersonas.mockResolvedValue([ana, beto, carla])
  api.catalogos.listarCatalogo.mockResolvedValue([{ id: 1, nombre: 'AIR-E' }])
  api.items.listarItems.mockResolvedValue([
    crearItem({ responsable_id: 1 }),
    crearItem({ responsable_id: 1 }),
    crearItem({ responsable_id: 1, estado: 'Terminado' }),
  ])
  api.clickup.listarTableros.mockResolvedValue([
    crearTablero({ id: 1, nombre: 'Desarrollo' }),
    crearTablero({ id: 2, nombre: 'Analítica' }),
  ])
})

const abrirEdicion = async (nombre) => {
  const ficha = (await screen.findByText(nombre)).closest('article')
  await usuario.click(within(ficha).getByRole('button', { name: 'Editar' }))
}

describe('Equipo · tablero de ClickUp', () => {
  it('la ficha muestra el tablero de la persona', async () => {
    renderizar(<Equipo />)
    const ficha = (await screen.findByText('Ana Gómez')).closest('article')
    expect(within(ficha).getByText('Desarrollo')).toBeInTheDocument()
    const sinTablero = screen.getByText('Beto Ruiz').closest('article')
    expect(within(sinTablero).queryByText('Desarrollo')).not.toBeInTheDocument()
  })

  it('la búsqueda también encuentra por tablero', async () => {
    renderizar(<Equipo />)
    await screen.findByText('Ana Gómez')
    await usuario.type(screen.getByLabelText(/Buscar/), 'desarrollo')
    expect(screen.getByText('Ana Gómez')).toBeInTheDocument()
    expect(screen.queryByText('Beto Ruiz')).not.toBeInTheDocument()
  })

  it('el editor ofrece los tableros y «Sin tablero» para el equipo', async () => {
    renderizar(<Equipo />)
    await abrirEdicion('Beto Ruiz')
    const selector = await screen.findByLabelText('Tablero de ClickUp')
    expect(selector).toHaveValue('')
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Analítica' })).toBeInTheDocument())
    expect(within(selector).getAllByRole('option').map((o) => o.textContent)).toEqual(['Sin tablero', 'Desarrollo', 'Analítica'])
  })

  it('el editor de un stakeholder no pide tablero', async () => {
    renderizar(<Equipo />)
    await usuario.click(await screen.findByRole('button', { name: 'Stakeholders' }))
    await abrirEdicion('Carla Soto')
    await screen.findByText('Editar a Carla Soto')
    expect(screen.queryByLabelText('Tablero de ClickUp')).not.toBeInTheDocument()
  })

  it('al cambiar de tipo a stakeholder desaparece el selector y se guarda sin tablero', async () => {
    renderizar(<Equipo />)
    await abrirEdicion('Ana Gómez')
    await screen.findByLabelText('Tablero de ClickUp')
    await usuario.selectOptions(screen.getByLabelText('Tipo'), 'Stakeholder')
    expect(screen.queryByLabelText('Tablero de ClickUp')).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(api.personas.guardarPersona).toHaveBeenCalled())
    expect(argumentoDe(api.personas.guardarPersona).datos).toMatchObject({ tipo: 'stakeholder', tablero_id: null })
  })

  it('guarda el tablero elegido', async () => {
    renderizar(<Equipo />)
    await abrirEdicion('Beto Ruiz')
    const selector = await screen.findByLabelText('Tablero de ClickUp')
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Analítica' })).toBeInTheDocument())
    await usuario.selectOptions(selector, 'Analítica')
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(api.personas.guardarPersona).toHaveBeenCalled())
    expect(argumentoDe(api.personas.guardarPersona)).toMatchObject({ id: 2, datos: { tablero_id: 2 } })
  })

  it('quitar el tablero guarda null', async () => {
    renderizar(<Equipo />)
    await abrirEdicion('Ana Gómez')
    await usuario.selectOptions(await screen.findByLabelText('Tablero de ClickUp'), 'Sin tablero')
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(api.personas.guardarPersona).toHaveBeenCalled())
    expect(argumentoDe(api.personas.guardarPersona).datos.tablero_id).toBeNull()
  })

  it('avisa que cambiar el tablero mueve los ítems abiertos en ClickUp', async () => {
    renderizar(<Equipo />)
    await abrirEdicion('Ana Gómez')
    const selector = await screen.findByLabelText('Tablero de ClickUp')
    expect(screen.queryByText(/se moverán a la lista del nuevo tablero/)).not.toBeInTheDocument()
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Analítica' })).toBeInTheDocument())
    await usuario.selectOptions(selector, 'Analítica')
    expect(screen.getByText('Al cambiar el tablero, los 2 ítem(s) abiertos de Ana Gómez se moverán a la lista del nuevo tablero en ClickUp.')).toBeInTheDocument()
    await usuario.selectOptions(selector, 'Desarrollo')
    expect(screen.queryByText(/se moverán a la lista del nuevo tablero/)).not.toBeInTheDocument()
  })

  it('una persona nueva no muestra el aviso de movimiento', async () => {
    renderizar(<Equipo />)
    await usuario.click(await screen.findByRole('button', { name: /Agregar persona/ }))
    const selector = await screen.findByLabelText('Tablero de ClickUp')
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Analítica' })).toBeInTheDocument())
    await usuario.selectOptions(selector, 'Analítica')
    expect(screen.queryByText(/se moverán a la lista del nuevo tablero/)).not.toBeInTheDocument()
  })

  it('si los tableros no se pueden leer la página sigue funcionando', async () => {
    api.clickup.listarTableros.mockRejectedValue(new Error('migración sin aplicar'))
    renderizar(<Equipo />)
    expect(await screen.findByText('Ana Gómez')).toBeInTheDocument()
  })
})
