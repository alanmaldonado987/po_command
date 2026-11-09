import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { argumentoDe } from '../../test/ayudas'
import { crearTablero } from '../../test/fabricas'
import { renderizar } from '../../test/renderizar'
import { ImportarExistentes } from './ImportarExistentes'

vi.mock('../../api/clickup', async () => (await import('../../test/apiFalsa')).clickup)
vi.mock('../../api/catalogos', async () => (await import('../../test/apiFalsa')).catalogos)

const usuario = userEvent.setup({ delay: null })
const ESTADO = { ...api.ESTADO_CLICKUP_BASE, equipo: { id: 't1', nombre: 'Ises' }, habilitado: true }

beforeEach(() => {
  api.reiniciarApiFalsa()
  api.catalogos.listarCatalogo.mockResolvedValue([{ id: 1, nombre: 'AIR-E' }])
})

const elegirLista = async (nombre) => {
  const lista = screen.getByLabelText('Lista de ClickUp')
  await waitFor(() => expect(within(lista).getAllByRole('option').length).toBeGreaterThan(1))
  await usuario.selectOptions(lista, nombre)
}

describe('ImportarExistentes · tablero', () => {
  it('sin tableros el selector está deshabilitado', async () => {
    renderizar(<ImportarExistentes estado={ESTADO} />)
    expect(await screen.findByLabelText('Tablero de la lista')).toBeDisabled()
  })

  it('con tableros permite elegir uno y lo envía a la importación', async () => {
    api.clickup.listarTableros.mockResolvedValue([crearTablero({ id: 7, nombre: 'Analítica' })])
    renderizar(<ImportarExistentes estado={ESTADO} />)
    await elegirLista('Innovación y Desarrollo OTC / Plan de Trabajo / AIR-E')
    const selector = screen.getByLabelText('Tablero de la lista')
    await waitFor(() => expect(within(selector).getByRole('option', { name: 'Analítica' })).toBeInTheDocument())
    await usuario.selectOptions(selector, 'Analítica')
    await usuario.click(screen.getByRole('button', { name: 'Importar tareas' }))
    await waitFor(() => expect(api.clickup.importarExistentesClickUp).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.importarExistentesClickUp)).toEqual({ listaId: 'l1', clienteId: null, tableroId: 7 })
  })
})
