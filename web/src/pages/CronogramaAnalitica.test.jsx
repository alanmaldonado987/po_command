import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../test/apiFalsa'
import { crearItem, crearNota } from '../test/fabricas'
import { renderizar } from '../test/renderizar'
import Analitica from './Analitica'
import Cronograma from './Cronograma'

vi.mock('../api/items', async () => (await import('../test/apiFalsa')).items)
vi.mock('../api/alertas', async () => (await import('../test/apiFalsa')).alertas)

const usuario = userEvent.setup({ delay: null })

beforeEach(() => api.reiniciarApiFalsa())

const kpi = (etiqueta) =>
  screen.getAllByText(etiqueta).find((elemento) => elemento.className.includes('uppercase')).parentElement

describe('Cronograma', () => {
  const conFechas = crearItem({
    id: 1,
    codigo: 'BL-001',
    cliente: 'AIR-E',
    actividad: 'SCR',
    plan_ini: '2026-08-10',
    plan_fin: '2026-08-25',
    real_ini: '2026-08-11',
    fecha_compromiso: '2026-08-25',
  })
  const sinFechas = crearItem({ id: 2, codigo: 'BL-002', cliente: 'AIR-E', actividad: 'Cobro' })
  const otroCliente = crearItem({ id: 3, codigo: 'BL-003', cliente: 'AFINIA', plan_ini: '2026-09-01', plan_fin: '2026-09-05' })
  const cerrado = crearItem({ id: 4, codigo: 'BL-004', cliente: 'AIR-E', estado: 'Terminado', plan_ini: '2026-07-01', plan_fin: '2026-07-02' })

  it('muestra carga y error', async () => {
    api.items.listarItems.mockReturnValue(new Promise(() => {}))
    const { unmount } = renderizar(<Cronograma />)
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    unmount()
    api.items.listarItems.mockRejectedValue(new Error('caído'))
    renderizar(<Cronograma />)
    expect(await screen.findByText(/caído/)).toBeInTheDocument()
  })

  it('sin clientes sugiere crear o importar', async () => {
    renderizar(<Cronograma />)
    expect(await screen.findByText(/Aún no hay ítems con cliente/)).toBeInTheDocument()
  })

  it('muestra el cronograma del primer cliente, KPIs y los ítems sin fechas', async () => {
    api.items.listarItems.mockResolvedValue([conFechas, sinFechas, otroCliente, cerrado])
    renderizar(<Cronograma />)
    expect(await screen.findByText('Cronograma · AFINIA')).toBeInTheDocument()
    await usuario.selectOptions(screen.getByLabelText('Cliente'), 'AIR-E')
    expect(await screen.findByText('Cronograma · AIR-E')).toBeInTheDocument()
    expect(within(kpi('Ítems en vista')).getByText('2')).toBeInTheDocument()
    expect(within(kpi('Sin fechas')).getByText('1')).toBeInTheDocument()
    expect(screen.getByText('1 ítem(s) sin fechas')).toBeInTheDocument()
    expect(screen.getByText(/BL-001 · SCR/)).toBeInTheDocument()
    expect(screen.queryByText(/BL-004 ·/)).not.toBeInTheDocument()
  })

  it('Solo abiertos puede desactivarse para ver los terminados', async () => {
    api.items.listarItems.mockResolvedValue([conFechas, cerrado])
    renderizar(<Cronograma />)
    await screen.findByText('Cronograma · AIR-E')
    expect(within(kpi('Ítems en vista')).getByText('1')).toBeInTheDocument()
    await usuario.click(screen.getByRole('switch', { name: 'Solo abiertos' }))
    await waitFor(() => expect(within(kpi('Ítems en vista')).getByText('2')).toBeInTheDocument())
  })

  it('un cliente sin ítems con fechas muestra el aviso en la tarjeta', async () => {
    api.items.listarItems.mockResolvedValue([sinFechas])
    renderizar(<Cronograma />)
    expect(await screen.findByText('Ningún ítem de este filtro tiene fechas.')).toBeInTheDocument()
  })
})

describe('Analítica', () => {
  const terminadoATiempo = crearItem({
    id: 1, estado: 'Terminado', cliente: 'AIR-E', actividad: 'SCR', alcance: 'Web',
    fecha_compromiso: '2026-01-10', fecha_entrega: '2026-01-10', atraso_dias: 0,
  })
  const atrasado = crearItem({ id: 2, cliente: 'AIR-E', actividad: 'SCR', alcance: 'Mobile', atrasado: true, atraso_dias: 10, modulo: 'Torre' })
  const otro = crearItem({ id: 3, cliente: 'AFINIA', actividad: 'Cobro', alcance: 'Web' })

  it('muestra carga, error y vacío', async () => {
    api.items.listarItems.mockReturnValue(new Promise(() => {}))
    const { unmount } = renderizar(<Analitica />)
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    unmount()
    api.items.listarItems.mockResolvedValue([])
    const vacio = renderizar(<Analitica />)
    expect(await screen.findByText('Aún no hay ítems en el backlog.')).toBeInTheDocument()
    vacio.unmount()
    api.items.listarItems.mockRejectedValue(new Error('sin red'))
    renderizar(<Analitica />)
    expect(await screen.findByText(/sin red/)).toBeInTheDocument()
  })

  it('calcula los KPIs del conjunto completo', async () => {
    api.items.listarItems.mockResolvedValue([terminadoATiempo, atrasado, otro])
    api.items.listarTodasLasNotas.mockResolvedValue([crearNota({ item_id: 2, tipo: 'Reprogramación' })])
    api.items.listarBloqueantes.mockResolvedValue([
      { id: 1, item_id: 2, abierto_en: '2026-11-01T00:00:00Z', resuelto_en: '2026-11-01T12:00:00Z' },
    ])
    renderizar(<Analitica />)
    await screen.findByText('Entrega a tiempo')
    expect(within(kpi('Avance')).getByText('33%')).toBeInTheDocument()
    expect(within(kpi('Entrega a tiempo')).getByText('100%')).toBeInTheDocument()
    expect(within(kpi('Atrasados')).getByText('10 días en promedio')).toBeInTheDocument()
    expect(within(kpi('Reprogramaciones')).getByText('1')).toBeInTheDocument()
    expect(within(kpi('Resolución de bloqueos')).getByText('12 h')).toBeInTheDocument()
  })

  it('filtra por cliente y recalcula', async () => {
    api.items.listarItems.mockResolvedValue([terminadoATiempo, atrasado, otro])
    renderizar(<Analitica />)
    await screen.findByText('Entrega a tiempo')
    const campo = screen.getAllByText('Cliente').find((el) => el.classList.contains('field-label')).parentElement
    await usuario.click(within(campo).getByRole('button'))
    await usuario.click(await screen.findByLabelText('AFINIA'))
    await waitFor(() => expect(within(kpi('Avance')).getByText('0%')).toBeInTheDocument())
    expect(within(kpi('Entrega a tiempo')).getByText('-')).toBeInTheDocument()
    expect(within(kpi('Atrasados')).getByText('Ninguno')).toBeInTheDocument()
  })

  it('lista módulos con atrasos y muestra el resumen por cliente y actividad', async () => {
    api.items.listarItems.mockResolvedValue([terminadoATiempo, atrasado, otro])
    renderizar(<Analitica />)
    expect(await screen.findByText('Módulos con más atrasos')).toBeInTheDocument()
    expect(screen.getByText('Avance por actividad')).toBeInTheDocument()
    expect(screen.getByText('Avance por alcance')).toBeInTheDocument()
    expect(screen.getByText('Abiertos y atrasados por responsable')).toBeInTheDocument()
  })

  it('un filtro sin coincidencias muestra el estado vacío', async () => {
    api.items.listarItems.mockResolvedValue([terminadoATiempo])
    renderizar(<Analitica />)
    await screen.findByText('Entrega a tiempo')
    expect(screen.queryByText('Ningún ítem coincide con el filtro.')).not.toBeInTheDocument()
  })
})
