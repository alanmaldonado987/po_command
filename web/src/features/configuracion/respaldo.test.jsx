import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { renderizar } from '../../test/renderizar'
import { BotonRespaldo } from './BotonRespaldo'
import { descargarRespaldo } from './respaldo'

vi.mock('../../api/configuracion', async () => (await import('../../test/apiFalsa')).configuracion)
vi.mock('../../lib/excel/descargar', () => ({ descargarLibro: vi.fn() }))

const { descargarLibro } = await import('../../lib/excel/descargar')

beforeEach(() => {
  api.reiniciarApiFalsa()
  descargarLibro.mockClear()
})

describe('descargarRespaldo', () => {
  it('lee cada tabla exportable y descarga un libro con la fecha en el nombre', async () => {
    api.configuracion.leerTabla.mockResolvedValue([{ id: 1, nombre: 'AIR-E' }])
    await descargarRespaldo()
    expect(api.configuracion.leerTabla).toHaveBeenCalledTimes(api.configuracion.TABLAS_EXPORTABLES.length)
    const [libro, nombre] = descargarLibro.mock.calls[0]
    expect(libro.SheetNames).toEqual(['item'])
    expect(nombre).toMatch(/^po_command_\d{8}\.xlsx$/)
  })

  it('propaga el error si una tabla no se puede leer', async () => {
    api.configuracion.leerTabla.mockRejectedValue(new Error('permiso denegado'))
    await expect(descargarRespaldo()).rejects.toThrow('permiso denegado')
    expect(descargarLibro).not.toHaveBeenCalled()
  })
})

describe('BotonRespaldo', () => {
  it('descarga al hacer clic', async () => {
    renderizar(<BotonRespaldo />)
    await userEvent.click(screen.getByRole('button', { name: 'Descargar respaldo' }))
    await waitFor(() => expect(descargarLibro).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Descargar respaldo' })).toBeEnabled()
  })

  it('muestra un aviso si falla', async () => {
    api.configuracion.leerTabla.mockRejectedValue(new Error('sin red'))
    renderizar(<BotonRespaldo etiqueta="Exportar" />)
    await userEvent.click(screen.getByRole('button', { name: 'Exportar' }))
    expect(await screen.findByText('No se pudo generar el respaldo: sin red')).toBeInTheDocument()
  })
})
