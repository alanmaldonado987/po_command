import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { argumentoDe } from '../../test/ayudas'
import { renderizar } from '../../test/renderizar'
import { ReconciliarForzado } from './ReconciliarForzado'

vi.mock('../../api/clickup', async () => (await import('../../test/apiFalsa')).clickup)

const usuario = userEvent.setup({ delay: null })
const abrir = async () => usuario.click(screen.getByRole('button', { name: 'Reconciliar a la fuerza' }))

beforeEach(() => api.reiniciarApiFalsa())

describe('ReconciliarForzado', () => {
  it('queda deshabilitado si la integración no está operativa', () => {
    renderizar(<ReconciliarForzado operativo={false} />)
    expect(screen.getByRole('button', { name: 'Reconciliar a la fuerza' })).toBeDisabled()
  })

  it('pide confirmación explicando qué se pisa y enfoca el diálogo', async () => {
    renderizar(<ReconciliarForzado operativo />)
    await abrir()
    const dialogo = screen.getByRole('dialog', { name: 'Reconciliar a la fuerza' })
    expect(dialogo).toHaveTextContent('Se pisarán los cambios que hayas hecho en la app desde que se importaron')
    expect(dialogo).toHaveTextContent('Los ítems eliminados y los que tienen un cambio pendiente de enviar')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    expect(api.clickup.reconciliarClickUp).not.toHaveBeenCalled()
  })

  it('Cancelar cierra el diálogo sin reconciliar y devuelve el foco al botón', async () => {
    renderizar(<ReconciliarForzado operativo />)
    await abrir()
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.clickup.reconciliarClickUp).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reconciliar a la fuerza' })).toHaveFocus())
  })

  it('Escape cierra el diálogo sin reconciliar', async () => {
    renderizar(<ReconciliarForzado operativo />)
    await abrir()
    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.clickup.reconciliarClickUp).not.toHaveBeenCalled()
  })

  it('confirmar reconcilia con forzar, informa el resumen y cierra', async () => {
    api.clickup.reconciliarClickUp.mockResolvedValue({ creadas: 0, actualizadas: 97, archivadas: 1 })
    renderizar(<ReconciliarForzado operativo />)
    await abrir()
    await usuario.click(screen.getByRole('button', { name: 'Sí, reconciliar a la fuerza' }))
    await waitFor(() => expect(api.clickup.reconciliarClickUp).toHaveBeenCalledTimes(1))
    expect(argumentoDe(api.clickup.reconciliarClickUp)).toEqual({ forzar: true })
    expect(
      await screen.findByText('Reconciliación forzada: 0 creada(s), 97 actualizada(s), 1 archivada(s).'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('si falla muestra el error y deja el diálogo abierto para reintentar', async () => {
    api.clickup.reconciliarClickUp.mockRejectedValue(new Error('ClickUp limitó las llamadas'))
    renderizar(<ReconciliarForzado operativo />)
    await abrir()
    await usuario.click(screen.getByRole('button', { name: 'Sí, reconciliar a la fuerza' }))
    expect(await screen.findByText('ClickUp limitó las llamadas')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Reconciliar a la fuerza' })).toBeInTheDocument()
  })
})
