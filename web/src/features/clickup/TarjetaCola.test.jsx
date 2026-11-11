import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { crearItem } from '../../test/fabricas'
import { renderizar } from '../../test/renderizar'
import { TarjetaCola } from './TarjetaCola'

vi.mock('../../api/clickup', async () => (await import('../../test/apiFalsa')).clickup)
vi.mock('../../api/items', async () => (await import('../../test/apiFalsa')).items)

const usuario = userEvent.setup({ delay: null })

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

const ESTADO = { pendientes: 2, con_error: 1 }

const servir = (filas) =>
  api.clickup.listarColaClickUp.mockImplementation(async ({ estados }) =>
    filas.filter((fila) => !estados || estados.includes(fila.estado)),
  )

const mostrar = (props = {}) => {
  const alFiltrar = vi.fn()
  renderizar(<TarjetaCola estado={ESTADO} filtro="todos" onFiltro={alFiltrar} {...props} />)
  return alFiltrar
}

beforeEach(() => {
  api.reiniciarApiFalsa()
  api.items.listarItems.mockResolvedValue([crearItem({ id: 10, codigo: 'BL-010', titulo: 'Mapa de calor' })])
})

describe('TarjetaCola', () => {
  it('muestra el selector con el conteo de pendientes y con error', () => {
    mostrar()
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Pendientes · 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Con error · 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviados' })).toBeInTheDocument()
  })

  it.each([
    ['todos', 'Aún no se ha enviado nada a ClickUp.'],
    ['pendientes', 'No hay envíos pendientes.'],
    ['errores', 'No hay envíos con error.'],
    ['enviados', 'Aún no hay envíos completados.'],
  ])('sin filas en «%s» muestra el vacío', async (filtro, texto) => {
    mostrar({ filtro })
    expect(await screen.findByText(texto)).toBeInTheDocument()
  })

  it('lista cada envío con código, título, acción, estado e intentos', async () => {
    servir([
      fila({ id: 1, accion: 'create' }),
      fila({ id: 2, accion: 'update', estado: 'Pendiente', procesado_en: null }),
      fila({ id: 3, accion: 'archive', intentos: 2 }),
      fila({ id: 4, accion: 'mover' }),
    ])
    mostrar()
    expect(await screen.findByText('BL-010 · Crear')).toBeInTheDocument()
    expect(screen.getByText('BL-010 · Actualizar')).toBeInTheDocument()
    expect(screen.getByText('BL-010 · Archivar')).toBeInTheDocument()
    expect(screen.getByText('BL-010 · Mover')).toBeInTheDocument()
    expect(screen.getAllByText('Mapa de calor')).toHaveLength(4)
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByText('Intentos: 2')).toBeInTheDocument()
  })

  it('un envío fallido muestra su error completo y qué hacer', async () => {
    servir([
      fila({ estado: 'Fallida', error: 'Sin destino configurado para Desarrollo / AIR-E', intentos: 3 }),
    ])
    mostrar()
    expect(await screen.findByText('Sin destino configurado para Desarrollo / AIR-E')).toBeInTheDocument()
    expect(screen.getByText(/tarjeta Destinos/)).toBeInTheDocument()
    expect(screen.getByText('Fallida')).toBeInTheDocument()
  })

  it('un error desconocido se muestra sin explicación inventada', async () => {
    servir([fila({ estado: 'Fallida', error: 'fallo raro' })])
    mostrar()
    expect(await screen.findByText('fallo raro')).toBeInTheDocument()
    expect(screen.queryByText(/Qué hacer/)).not.toBeInTheDocument()
  })

  it('un error largo se resume y se puede ver completo', async () => {
    const largo = `ClickUp 400: ${'campo inválido '.repeat(40)}FIN`
    servir([fila({ estado: 'Fallida', error: largo })])
    mostrar()
    const detalle = (await screen.findByText('Ver error completo')).closest('details')
    expect(within(detalle).getByText(largo)).toBeInTheDocument()
  })

  it('si el ítem ya no está en la lista usa su identificador', async () => {
    servir([fila({ item_id: 77 })])
    mostrar()
    expect(await screen.findByText('Ítem 77 · Crear')).toBeInTheDocument()
  })

  it('una acción desconocida se muestra tal cual', async () => {
    servir([fila({ accion: 'reindexar' })])
    mostrar()
    expect(await screen.findByText('BL-010 · reindexar')).toBeInTheDocument()
  })

  it('elegir un filtro avisa a quien lo controla', async () => {
    const alFiltrar = mostrar()
    await usuario.click(screen.getByRole('button', { name: 'Con error · 1' }))
    expect(alFiltrar).toHaveBeenCalledWith('errores')
  })

  it('con el filtro «errores» pide solo los fallidos', async () => {
    mostrar({ filtro: 'errores' })
    await screen.findByText('No hay envíos con error.')
    expect(api.clickup.listarColaClickUp).toHaveBeenCalledWith({ estados: ['Fallida'], limite: 20 })
  })

  it('«Ver más» pide otra página cuando puede haber más filas', async () => {
    const pagina = Array.from({ length: 20 }, (_, i) => fila({ id: 100 - i, accion: 'update' }))
    servir(pagina)
    mostrar({ filtro: 'enviados' })
    await usuario.click(await screen.findByRole('button', { name: 'Ver más' }))
    expect(api.clickup.listarColaClickUp).toHaveBeenCalledWith({ estados: ['Enviada'], limite: 40 })
  })

  it('sin más filas no ofrece «Ver más»', async () => {
    servir([fila()])
    mostrar({ filtro: 'enviados' })
    await screen.findByText('BL-010 · Crear')
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument()
  })

  it('si la consulta falla muestra el error', async () => {
    api.clickup.listarColaClickUp.mockRejectedValue(new Error('sin permisos'))
    mostrar()
    expect(await screen.findByText(/sin permisos/)).toBeInTheDocument()
  })
})
