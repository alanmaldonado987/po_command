import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { crearItem } from '../../test/fabricas'
import { renderizar } from '../../test/renderizar'
import { TablaBacklog } from './TablaBacklog'

vi.mock('../../api/items', async () => (await import('../../test/apiFalsa')).items)

const usuario = userEvent.setup({ delay: null })

beforeEach(() => api.reiniciarApiFalsa())

const fila = (codigo) => screen.getByRole('row', { name: new RegExp(codigo) })

describe('TablaBacklog · columna ClickUp', () => {
  it('incluye la columna ClickUp en el encabezado', () => {
    renderizar(<TablaBacklog items={[crearItem({ id: 1 })]} seleccionado={null} alSeleccionar={() => {}} />)
    expect(screen.getByRole('columnheader', { name: 'ClickUp' })).toBeInTheDocument()
  })

  it('marca con un icono solo los ítems vinculados a una tarea', () => {
    const items = [
      crearItem({ id: 1, codigo: 'BL-001', clickup_task_id: 'abc' }),
      crearItem({ id: 2, codigo: 'BL-002' }),
      crearItem({ id: 3, codigo: 'BL-003', clickup_task_id: 'def' }),
    ]
    renderizar(<TablaBacklog items={items} seleccionado={null} alSeleccionar={() => {}} />)
    expect(screen.getAllByLabelText('Vinculado a ClickUp')).toHaveLength(2)
    expect(within(fila('BL-001')).getByLabelText('Vinculado a ClickUp')).toBeInTheDocument()
    expect(within(fila('BL-002')).queryByLabelText('Vinculado a ClickUp')).not.toBeInTheDocument()
    expect(within(fila('BL-003')).getByLabelText('Vinculado a ClickUp')).toBeInTheDocument()
  })

  it('seleccionar una fila vinculada sigue notificando su id', async () => {
    const alSeleccionar = vi.fn()
    renderizar(
      <TablaBacklog items={[crearItem({ id: 9, codigo: 'BL-009', clickup_task_id: 'abc' })]} seleccionado={null} alSeleccionar={alSeleccionar} />,
    )
    await usuario.click(fila('BL-009'))
    expect(alSeleccionar).toHaveBeenCalledWith(9)
  })
})
