import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { crearItem } from '../../test/fabricas'
import { renderizar } from '../../test/renderizar'
import { TablaBacklog } from './TablaBacklog'

vi.mock('../../api/items', async () => (await import('../../test/apiFalsa')).items)

beforeEach(() => api.reiniciarApiFalsa())

const fila = (codigo) => screen.getByRole('row', { name: new RegExp(codigo) })

describe('TablaBacklog · tablero de ClickUp', () => {
  it('muestra un chip con el tablero del responsable', () => {
    const items = [
      crearItem({ id: 1, codigo: 'BL-001', tablero_id: 1, tablero: 'Plataforma' }),
      crearItem({ id: 2, codigo: 'BL-002', tablero_id: 2, tablero: 'Datos', clickup_task_id: 'abc' }),
      crearItem({ id: 3, codigo: 'BL-003' }),
    ]
    renderizar(<TablaBacklog items={items} seleccionado={null} alSeleccionar={() => {}} />)
    expect(within(fila('BL-001')).getByText('Plataforma')).toBeInTheDocument()
    expect(within(fila('BL-002')).getByText('Datos')).toBeInTheDocument()
    expect(within(fila('BL-002')).getByLabelText('Vinculado a ClickUp')).toBeInTheDocument()
    expect(within(fila('BL-001')).queryByLabelText('Vinculado a ClickUp')).not.toBeInTheDocument()
    expect(within(fila('BL-003')).queryByText('Plataforma')).not.toBeInTheDocument()
  })
})
