import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { argumentoDe } from '../../test/ayudas'
import { renderizar } from '../../test/renderizar'
import { TarjetaDestinos } from './TarjetaDestinos'

vi.mock('../../api/clickup', async () => (await import('../../test/apiFalsa')).clickup)
vi.mock('../../api/catalogos', async () => (await import('../../test/apiFalsa')).catalogos)

const usuario = userEvent.setup({ delay: null })
const EQUIPO = { id: 't1', nombre: 'Ises' }
const RUTA_AIRE = 'Innovación y Desarrollo OTC / Plan de Trabajo / AIR-E'

const CLIENTES = [
  { id: 1, nombre: 'AIR-E' },
  { id: 2, nombre: 'ELECTROHUILA' },
]

beforeEach(() => {
  api.reiniciarApiFalsa()
  api.catalogos.listarCatalogo.mockResolvedValue(CLIENTES)
})

const elegirLista = async (titulo, { carpeta = 'Plan de Trabajo', lista = 'AIR-E' } = {}) => {
  await usuario.selectOptions(await screen.findByLabelText(`Espacio de ${titulo}`), 'Innovación y Desarrollo OTC')
  await usuario.selectOptions(screen.getByLabelText(`Carpeta de ${titulo}`), carpeta)
  await usuario.selectOptions(screen.getByLabelText(`Lista de ${titulo}`), lista)
}

describe('TarjetaDestinos · sin equipo', () => {
  it('pide elegir un equipo y no lee la jerarquía', () => {
    renderizar(<TarjetaDestinos equipo={null} />)
    expect(screen.getByText(/Elige un equipo en la tarjeta de conexión/)).toBeInTheDocument()
    expect(api.clickup.obtenerJerarquiaClickUp).not.toHaveBeenCalled()
  })
})

describe('TarjetaDestinos · filas', () => {
  it('muestra el destino por defecto y una fila por cliente', async () => {
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    expect(await screen.findByText('Destino por defecto')).toBeInTheDocument()
    expect(screen.getByText('AIR-E')).toBeInTheDocument()
    expect(screen.getByText('ELECTROHUILA')).toBeInTheDocument()
    expect(api.clickup.obtenerJerarquiaClickUp).toHaveBeenCalledWith('t1')
  })

  it('sin destinos los clientes aparecen como «Sin destino»', async () => {
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await screen.findByText('Destino por defecto')
    expect(screen.getAllByText('Sin destino')).toHaveLength(2)
  })

  it('con destino por defecto, los clientes sin destino propio lo usan', async () => {
    api.clickup.listarDestinos.mockResolvedValue([{ id: 7, cliente_id: null, lista_id: 'l9', lista_nombre: 'Backlog Dev' }])
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    expect(await screen.findAllByText('Usa el destino por defecto')).toHaveLength(2)
    expect(screen.getByText('Lista actual: Backlog Dev')).toBeInTheDocument()
  })

  it('el cliente con destino propio muestra su lista actual y no el aviso', async () => {
    api.clickup.listarDestinos.mockResolvedValue([{ id: 3, cliente_id: 1, lista_id: 'l1', lista_nombre: RUTA_AIRE }])
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    expect(await screen.findByText(`Lista actual: ${RUTA_AIRE}`)).toBeInTheDocument()
    expect(screen.getAllByText('Sin destino')).toHaveLength(1)
  })

  it('si la jerarquía falla muestra el error', async () => {
    api.clickup.obtenerJerarquiaClickUp.mockRejectedValue(new Error('token vencido'))
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    expect(await screen.findByText(/token vencido/)).toBeInTheDocument()
  })
})

describe('TarjetaDestinos · selector en cascada', () => {
  it('las carpetas y listas dependen del espacio y la carpeta elegidos', async () => {
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    const espacio = await screen.findByLabelText('Espacio de AIR-E')
    expect(screen.getByLabelText('Carpeta de AIR-E')).toBeDisabled()
    expect(screen.getByLabelText('Lista de AIR-E')).toBeDisabled()

    await usuario.selectOptions(espacio, 'Innovación y Desarrollo OTC')
    const carpeta = screen.getByLabelText('Carpeta de AIR-E')
    expect(carpeta).toBeEnabled()
    expect(within(carpeta).getByRole('option', { name: 'Sin carpeta' })).toBeInTheDocument()

    await usuario.selectOptions(carpeta, 'Plan de Trabajo')
    const listas = screen.getByLabelText('Lista de AIR-E')
    expect(within(listas).getAllByRole('option').map((o) => o.textContent)).toEqual(['Elige una lista', 'AIR-E', 'ELECTROHUILA'])

    await usuario.selectOptions(carpeta, 'Sin carpeta')
    expect(within(screen.getByLabelText('Lista de AIR-E')).getByRole('option', { name: 'Backlog Dev' })).toBeInTheDocument()
  })

  it('Guardar destino solo se habilita al elegir una lista', async () => {
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    const guardar = await screen.findByRole('button', { name: 'Guardar destino de AIR-E' })
    expect(guardar).toBeDisabled()
    await elegirLista('AIR-E')
    expect(guardar).toBeEnabled()
    await usuario.selectOptions(screen.getByLabelText('Carpeta de AIR-E'), 'Sin carpeta')
    expect(guardar).toBeDisabled()
  })
})

describe('TarjetaDestinos · guardar y quitar', () => {
  it('crea el destino de un cliente con la ruta completa de la lista', async () => {
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await elegirLista('AIR-E')
    await usuario.click(screen.getByRole('button', { name: 'Guardar destino de AIR-E' }))
    await waitFor(() => expect(api.clickup.guardarDestino).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.guardarDestino)).toEqual({
      id: null,
      tableroId: null,
      clienteId: 1,
      listaId: 'l1',
      listaNombre: RUTA_AIRE,
    })
    expect(await screen.findByText('Destino de AIR-E guardado.')).toBeInTheDocument()
  })

  it('el destino por defecto se guarda sin cliente', async () => {
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await elegirLista('Destino por defecto', { carpeta: 'Sin carpeta', lista: 'Backlog Dev' })
    await usuario.click(screen.getByRole('button', { name: 'Guardar destino de Destino por defecto' }))
    await waitFor(() => expect(api.clickup.guardarDestino).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.guardarDestino)).toMatchObject({ id: null, clienteId: null, listaId: 'l9' })
  })

  it('al cambiar un destino existente actualiza su id', async () => {
    api.clickup.listarDestinos.mockResolvedValue([{ id: 3, cliente_id: 1, lista_id: 'l1', lista_nombre: RUTA_AIRE }])
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await screen.findByText(`Lista actual: ${RUTA_AIRE}`)
    await elegirLista('AIR-E', { lista: 'ELECTROHUILA' })
    await usuario.click(screen.getByRole('button', { name: 'Guardar destino de AIR-E' }))
    await waitFor(() => expect(api.clickup.guardarDestino).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.guardarDestino)).toMatchObject({ id: 3, clienteId: 1, listaId: 'l2' })
  })

  it('quita un destino existente', async () => {
    api.clickup.listarDestinos.mockResolvedValue([{ id: 3, cliente_id: 1, lista_id: 'l1', lista_nombre: RUTA_AIRE }])
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await usuario.click(await screen.findByRole('button', { name: 'Quitar destino de AIR-E' }))
    await waitFor(() => expect(api.clickup.eliminarDestino).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.eliminarDestino)).toBe(3)
    expect(await screen.findByText('Destino de AIR-E quitado.')).toBeInTheDocument()
  })

  it('un cliente sin destino no ofrece quitar', async () => {
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await screen.findByText('Destino por defecto')
    expect(screen.queryByRole('button', { name: /Quitar destino/ })).not.toBeInTheDocument()
  })

  it('si guardar falla muestra el error', async () => {
    api.clickup.guardarDestino.mockRejectedValue(new Error('lista inexistente'))
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await elegirLista('AIR-E')
    await usuario.click(screen.getByRole('button', { name: 'Guardar destino de AIR-E' }))
    expect(await screen.findByText('lista inexistente')).toBeInTheDocument()
  })
})
