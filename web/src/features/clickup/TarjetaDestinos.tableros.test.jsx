import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { argumentoDe } from '../../test/ayudas'
import { crearDestino, crearTablero } from '../../test/fabricas'
import { renderizar } from '../../test/renderizar'
import { TarjetaDestinos } from './TarjetaDestinos'

vi.mock('../../api/clickup', async () => (await import('../../test/apiFalsa')).clickup)
vi.mock('../../api/catalogos', async () => (await import('../../test/apiFalsa')).catalogos)

const usuario = userEvent.setup({ delay: null })
const EQUIPO = { id: 't1', nombre: 'Ises' }
const RUTA_AIRE = 'Innovación y Desarrollo OTC / Plan de Trabajo / AIR-E'

const desarrollo = crearTablero({ id: 1, nombre: 'Desarrollo' })
const analitica = crearTablero({ id: 2, nombre: 'Analítica' })

beforeEach(() => {
  api.reiniciarApiFalsa()
  api.catalogos.listarCatalogo.mockResolvedValue([
    { id: 1, nombre: 'AIR-E' },
    { id: 2, nombre: 'ELECTROHUILA' },
  ])
  api.clickup.listarTableros.mockResolvedValue([desarrollo, analitica])
})

const elegirLista = async (titulo, { carpeta = 'Plan de Trabajo', lista = 'AIR-E' } = {}) => {
  await usuario.selectOptions(await screen.findByLabelText(`Espacio de ${titulo}`), 'Innovación y Desarrollo OTC')
  await usuario.selectOptions(screen.getByLabelText(`Carpeta de ${titulo}`), carpeta)
  await usuario.selectOptions(screen.getByLabelText(`Lista de ${titulo}`), lista)
}

const bloqueDe = (titulo) => screen.getByText(titulo).closest('div.space-y-3')

describe('TarjetaDestinos · secciones por tablero', () => {
  it('muestra la sección general y una por cada tablero', async () => {
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    expect(await screen.findByText('Sin tablero / por defecto')).toBeInTheDocument()
    expect(screen.getByText('Tablero Desarrollo')).toBeInTheDocument()
    expect(screen.getByText('Tablero Analítica')).toBeInTheDocument()
  })

  it('cada tablero tiene una fila para todos los clientes y una por cliente', async () => {
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await screen.findByText('Tablero Desarrollo')
    for (const titulo of ['Desarrollo · Todos los clientes', 'Desarrollo · AIR-E', 'Desarrollo · ELECTROHUILA', 'Analítica · AIR-E']) {
      expect(screen.getByText(titulo)).toBeInTheDocument()
    }
  })

  it('sin tableros solo existe la sección general', async () => {
    api.clickup.listarTableros.mockResolvedValue([])
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await screen.findByText('Sin tablero / por defecto')
    expect(screen.queryByText(/^Tablero /)).not.toBeInTheDocument()
  })
})

describe('TarjetaDestinos · herencia', () => {
  it('sin ningún destino todas las filas avisan que no hay destino', async () => {
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await screen.findByText('Tablero Desarrollo')
    expect(within(bloqueDe('Desarrollo · AIR-E')).getByText('Sin destino')).toBeInTheDocument()
    expect(within(bloqueDe('Desarrollo · Todos los clientes')).getByText('Sin destino')).toBeInTheDocument()
  })

  it('un tablero hereda del destino por defecto cuando no tiene el suyo', async () => {
    api.clickup.listarDestinos.mockResolvedValue([crearDestino({ id: 1, lista_nombre: 'Backlog Dev' })])
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await screen.findByText('Tablero Desarrollo')
    const fila = bloqueDe('Analítica · AIR-E')
    expect(within(fila).getByText('Usa el destino por defecto')).toBeInTheDocument()
    expect(within(fila).getByText('Se enviará a: Backlog Dev')).toBeInTheDocument()
  })

  it('un cliente del tablero hereda del destino del tablero para todos los clientes', async () => {
    api.clickup.listarDestinos.mockResolvedValue([
      crearDestino({ id: 1, lista_nombre: 'Backlog Dev' }),
      crearDestino({ id: 2, tablero_id: 2, lista_nombre: 'Lista Analítica' }),
    ])
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await screen.findByText('Tablero Desarrollo')
    const fila = bloqueDe('Analítica · ELECTROHUILA')
    expect(within(fila).getByText('Usa el destino del tablero')).toBeInTheDocument()
    expect(within(fila).getByText('Se enviará a: Lista Analítica')).toBeInTheDocument()
    expect(within(bloqueDe('Desarrollo · AIR-E')).getByText('Usa el destino por defecto')).toBeInTheDocument()
  })

  it('un tablero sin destino propio usa el destino del cliente sin tablero', async () => {
    api.clickup.listarDestinos.mockResolvedValue([
      crearDestino({ id: 1, lista_nombre: 'Backlog Dev' }),
      crearDestino({ id: 2, cliente_id: 1, lista_nombre: 'AIR-E general' }),
    ])
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await screen.findByText('Tablero Desarrollo')
    expect(within(bloqueDe('Desarrollo · AIR-E')).getByText('Usa el destino del cliente')).toBeInTheDocument()
  })

  it('el destino propio del tablero y cliente no muestra aviso y se identifica como actual', async () => {
    api.clickup.listarDestinos.mockResolvedValue([
      crearDestino({ id: 4, tablero_id: 1, cliente_id: 1, lista_id: 'l1', lista_nombre: RUTA_AIRE }),
    ])
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await screen.findByText('Tablero Desarrollo')
    const fila = bloqueDe('Desarrollo · AIR-E')
    expect(within(fila).getByText(`Lista actual: ${RUTA_AIRE}`)).toBeInTheDocument()
    expect(within(fila).queryByText(/Usa el destino/)).not.toBeInTheDocument()
    expect(within(fila).queryByText('Sin destino')).not.toBeInTheDocument()
  })
})

describe('TarjetaDestinos · guardar y quitar por tablero', () => {
  it('crea el destino de un tablero y un cliente', async () => {
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await elegirLista('Desarrollo · AIR-E')
    await usuario.click(screen.getByRole('button', { name: 'Guardar destino de Desarrollo · AIR-E' }))
    await waitFor(() => expect(api.clickup.guardarDestino).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.guardarDestino)).toEqual({
      id: null,
      tableroId: 1,
      clienteId: 1,
      listaId: 'l1',
      listaNombre: RUTA_AIRE,
    })
    expect(await screen.findByText('Destino de Desarrollo · AIR-E guardado.')).toBeInTheDocument()
  })

  it('el destino de «Todos los clientes» de un tablero se guarda sin cliente', async () => {
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await elegirLista('Analítica · Todos los clientes', { carpeta: 'Sin carpeta', lista: 'Backlog Dev' })
    await usuario.click(screen.getByRole('button', { name: 'Guardar destino de Analítica · Todos los clientes' }))
    await waitFor(() => expect(api.clickup.guardarDestino).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.guardarDestino)).toMatchObject({ id: null, tableroId: 2, clienteId: null, listaId: 'l9' })
  })

  it('actualiza el destino que ya existe para ese tablero y cliente, no el de otro tablero', async () => {
    api.clickup.listarDestinos.mockResolvedValue([
      crearDestino({ id: 30, tablero_id: 2, cliente_id: 1, lista_id: 'l2', lista_nombre: 'Otra' }),
      crearDestino({ id: 31, tablero_id: 1, cliente_id: 1, lista_id: 'l1', lista_nombre: RUTA_AIRE }),
    ])
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await screen.findByText(`Lista actual: ${RUTA_AIRE}`)
    await elegirLista('Desarrollo · AIR-E', { lista: 'ELECTROHUILA' })
    await usuario.click(screen.getByRole('button', { name: 'Guardar destino de Desarrollo · AIR-E' }))
    await waitFor(() => expect(api.clickup.guardarDestino).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.guardarDestino)).toMatchObject({ id: 31, tableroId: 1, clienteId: 1, listaId: 'l2' })
  })

  it('quita solo el destino de la fila elegida', async () => {
    api.clickup.listarDestinos.mockResolvedValue([
      crearDestino({ id: 30, tablero_id: 2, cliente_id: 1 }),
      crearDestino({ id: 31, tablero_id: 1, cliente_id: 1 }),
    ])
    renderizar(<TarjetaDestinos equipo={EQUIPO} />)
    await usuario.click(await screen.findByRole('button', { name: 'Quitar destino de Analítica · AIR-E' }))
    await waitFor(() => expect(api.clickup.eliminarDestino).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.eliminarDestino)).toBe(30)
    expect(await screen.findByText('Destino de Analítica · AIR-E quitado.')).toBeInTheDocument()
  })
})
