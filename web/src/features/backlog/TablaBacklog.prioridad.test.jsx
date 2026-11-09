import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { crearItem } from '../../test/fabricas'
import { renderizar } from '../../test/renderizar'
import { ChipPrioridad } from './ChipPrioridad'
import { TablaBacklog } from './TablaBacklog'

vi.mock('../../api/items', async () => (await import('../../test/apiFalsa')).items)

beforeEach(() => api.reiniciarApiFalsa())

const fila = (codigo) => screen.getByRole('row', { name: new RegExp(codigo) })

describe('TablaBacklog · prioridad', () => {
  it('tiene la columna Prioridad y muestra el chip de cada ítem con texto', () => {
    const items = [
      crearItem({ id: 1, codigo: 'BL-001', prioridad: 'Urgente' }),
      crearItem({ id: 2, codigo: 'BL-002', prioridad: 'Baja' }),
      crearItem({ id: 3, codigo: 'BL-003', prioridad: null }),
    ]
    renderizar(<TablaBacklog items={items} seleccionado={null} alSeleccionar={() => {}} />)
    expect(screen.getByRole('columnheader', { name: 'Prioridad' })).toBeInTheDocument()
    expect(within(fila('BL-001')).getByText('Urgente')).toBeInTheDocument()
    expect(within(fila('BL-002')).getByText('Baja')).toBeInTheDocument()
    expect(within(fila('BL-003')).queryByText(/Urgente|Alta|Normal|Baja/)).not.toBeInTheDocument()
  })
})

describe('ChipPrioridad', () => {
  it('no pinta nada sin prioridad', () => {
    renderizar(<ChipPrioridad prioridad={null} />)
    expect(screen.queryByText('flag')).not.toBeInTheDocument()
    expect(screen.queryByText(/Urgente|Alta|Normal|Baja/)).not.toBeInTheDocument()
  })

  it.each([
    ['Urgente', 'bg-danger-soft'],
    ['Alta', 'bg-warning-soft'],
    ['Normal', 'bg-brand-soft'],
    ['Baja', 'bg-line-soft'],
  ])('«%s» usa su tono y la bandera sin depender solo del color', (prioridad, clase) => {
    renderizar(<ChipPrioridad prioridad={prioridad} />)
    const chip = screen.getByText(prioridad).closest('span')
    expect(chip.className).toContain(clase)
    expect(chip.querySelector('[aria-hidden="true"]')).toHaveTextContent('flag')
  })
})
