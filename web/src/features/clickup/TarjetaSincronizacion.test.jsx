import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../test/apiFalsa'
import { argumentoDe } from '../../test/ayudas'
import { renderizar } from '../../test/renderizar'
import { TarjetaSincronizacion } from './TarjetaSincronizacion'

vi.mock('../../api/clickup', async () => (await import('../../test/apiFalsa')).clickup)
vi.mock('../../api/catalogos', async () => (await import('../../test/apiFalsa')).catalogos)

const usuario = userEvent.setup({ delay: null })
const EQUIPO = { id: 't1', nombre: 'Ises' }

const estado = (cambios = {}) => ({ ...api.ESTADO_CLICKUP_BASE, equipo: EQUIPO, ...cambios })
const OPERATIVO = { conectado: true, habilitado: true, token_configurado: true }

beforeEach(() => {
  api.reiniciarApiFalsa()
  api.catalogos.listarCatalogo.mockResolvedValue([{ id: 1, nombre: 'AIR-E' }])
})

describe('TarjetaSincronizacion · indicadores', () => {
  it('muestra pendientes, errores, webhook y último sync', () => {
    renderizar(
      <TarjetaSincronizacion
        estado={estado({ ...OPERATIVO, pendientes: 4, con_error: 2, webhook_registrado: true, ultimo_sync: '2026-11-06T15:30:00Z' })}
      />,
    )
    expect(screen.getByText('Pendientes').nextSibling).toHaveTextContent('4')
    expect(screen.getByText('Con error').nextSibling).toHaveTextContent('2')
    expect(screen.getByText('Webhook').nextSibling).toHaveTextContent('Activo')
    expect(screen.getByText('Último sync').nextSibling).not.toHaveTextContent('Nunca')
  })

  it('con manejador, pendientes y con error son botones que piden ver la cola filtrada', async () => {
    const alVerCola = vi.fn()
    renderizar(<TarjetaSincronizacion estado={estado({ pendientes: 4, con_error: 2 })} onVerCola={alVerCola} />)
    await usuario.click(screen.getByRole('button', { name: 'Pendientes: 4. Ver detalle' }))
    await usuario.click(screen.getByRole('button', { name: 'Con error: 2. Ver detalle' }))
    expect(alVerCola.mock.calls).toEqual([['pendientes'], ['errores']])
  })

  it('los contadores accionables se activan con el teclado', async () => {
    const alVerCola = vi.fn()
    renderizar(<TarjetaSincronizacion estado={estado({ con_error: 1 })} onVerCola={alVerCola} />)
    screen.getByRole('button', { name: 'Con error: 1. Ver detalle' }).focus()
    await usuario.keyboard('{Enter}')
    expect(alVerCola).toHaveBeenCalledWith('errores')
  })

  it('sin manejador los contadores son solo informativos', () => {
    renderizar(<TarjetaSincronizacion estado={estado({ pendientes: 4 })} />)
    expect(screen.queryByRole('button', { name: /Ver detalle/ })).not.toBeInTheDocument()
  })

  it('sin actividad indica webhook sin registrar y último sync «Nunca»', () => {
    renderizar(<TarjetaSincronizacion estado={estado()} />)
    expect(screen.getByText('Webhook').nextSibling).toHaveTextContent('Sin registrar')
    expect(screen.getByText('Último sync').nextSibling).toHaveTextContent('Nunca')
  })
})

describe('TarjetaSincronizacion · acciones', () => {
  it('registrar webhook, quitar webhook y sincronizar se deshabilitan sin conexión', () => {
    renderizar(<TarjetaSincronizacion estado={estado()} />)
    expect(screen.getByRole('button', { name: 'Registrar webhook' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Sincronizar ahora' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reconciliar' })).toBeDisabled()
  })

  it('conectado pero con la sincronización apagada solo permite el webhook', () => {
    renderizar(<TarjetaSincronizacion estado={estado({ conectado: true, token_configurado: true })} />)
    expect(screen.getByRole('button', { name: 'Registrar webhook' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Sincronizar ahora' })).toBeDisabled()
  })

  it('registra el webhook y avisa', async () => {
    renderizar(<TarjetaSincronizacion estado={estado(OPERATIVO)} />)
    await usuario.click(screen.getByRole('button', { name: 'Registrar webhook' }))
    await waitFor(() => expect(api.clickup.registrarWebhookClickUp).toHaveBeenCalled())
    expect(await screen.findByText('Webhook registrado: los cambios de ClickUp llegarán a la app.')).toBeInTheDocument()
  })

  it('con webhook activo el botón lo quita', async () => {
    renderizar(<TarjetaSincronizacion estado={estado({ ...OPERATIVO, webhook_registrado: true })} />)
    await usuario.click(screen.getByRole('button', { name: 'Quitar webhook' }))
    await waitFor(() => expect(api.clickup.quitarWebhookClickUp).toHaveBeenCalled())
    expect(await screen.findByText('Webhook quitado: ClickUp ya no avisa de sus cambios.')).toBeInTheDocument()
  })

  it('sincronizar ahora informa los cambios procesados', async () => {
    renderizar(<TarjetaSincronizacion estado={estado(OPERATIVO)} />)
    await usuario.click(screen.getByRole('button', { name: 'Sincronizar ahora' }))
    expect(await screen.findByText('3 cambio(s) procesado(s), 0 con error.')).toBeInTheDocument()
  })

  it('sincronizar con errores lo avisa como advertencia', async () => {
    api.clickup.sincronizarClickUp.mockResolvedValue({ procesadas: 5, errores: 2 })
    renderizar(<TarjetaSincronizacion estado={estado(OPERATIVO)} />)
    await usuario.click(screen.getByRole('button', { name: 'Sincronizar ahora' }))
    expect(await screen.findByText('5 cambio(s) procesado(s), 2 con error.')).toBeInTheDocument()
  })

  it('reconciliar informa creadas, actualizadas y archivadas', async () => {
    renderizar(<TarjetaSincronizacion estado={estado(OPERATIVO)} />)
    await usuario.click(screen.getByRole('button', { name: 'Reconciliar' }))
    expect(await screen.findByText('Reconciliación: 1 creada(s), 2 actualizada(s), 0 archivada(s).')).toBeInTheDocument()
  })

  it('si una acción falla muestra el error de la función', async () => {
    api.clickup.sincronizarClickUp.mockRejectedValue(new Error('ClickUp limitó las llamadas'))
    renderizar(<TarjetaSincronizacion estado={estado(OPERATIVO)} />)
    await usuario.click(screen.getByRole('button', { name: 'Sincronizar ahora' }))
    expect(await screen.findByText('ClickUp limitó las llamadas')).toBeInTheDocument()
  })
})

describe('TarjetaSincronizacion · importar tareas existentes', () => {
  const bloque = () => screen.getByText('Importar tareas existentes').closest('div.space-y-3')

  it('Importar tareas exige elegir una lista y tener la sincronización activa', async () => {
    renderizar(<TarjetaSincronizacion estado={estado({ conectado: true })} />)
    expect(within(bloque()).getByRole('button', { name: 'Importar tareas' })).toBeDisabled()
  })

  it('ofrece todas las listas con su ruta', async () => {
    renderizar(<TarjetaSincronizacion estado={estado(OPERATIVO)} />)
    const lista = within(bloque()).getByLabelText('Lista de ClickUp')
    await waitFor(() => expect(within(lista).getAllByRole('option').length).toBeGreaterThan(1))
    expect(within(lista).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Elige una lista',
      'Innovación y Desarrollo OTC / Backlog Dev',
      'Innovación y Desarrollo OTC / Plan de Trabajo / AIR-E',
      'Innovación y Desarrollo OTC / Plan de Trabajo / ELECTROHUILA',
    ])
  })

  it('importa la lista elegida sin cliente', async () => {
    renderizar(<TarjetaSincronizacion estado={estado(OPERATIVO)} />)
    const lista = within(bloque()).getByLabelText('Lista de ClickUp')
    await waitFor(() => expect(within(lista).getAllByRole('option').length).toBeGreaterThan(1))
    await usuario.selectOptions(lista, 'Innovación y Desarrollo OTC / Backlog Dev')
    await usuario.click(within(bloque()).getByRole('button', { name: 'Importar tareas' }))
    await waitFor(() => expect(api.clickup.importarExistentesClickUp).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.importarExistentesClickUp)).toEqual({ listaId: 'l9', clienteId: null, tableroId: null })
    expect(await screen.findByText('4 tarea(s) importada(s) desde ClickUp.')).toBeInTheDocument()
  })

  it('importa asignando el cliente elegido', async () => {
    renderizar(<TarjetaSincronizacion estado={estado(OPERATIVO)} />)
    const lista = within(bloque()).getByLabelText('Lista de ClickUp')
    await waitFor(() => expect(within(lista).getAllByRole('option').length).toBeGreaterThan(1))
    await usuario.selectOptions(lista, 'Innovación y Desarrollo OTC / Plan de Trabajo / AIR-E')
    await waitFor(() => expect(within(bloque()).getByRole('option', { name: 'AIR-E' })).toBeInTheDocument())
    await usuario.selectOptions(within(bloque()).getByLabelText('Cliente de los ítems'), 'AIR-E')
    await usuario.click(within(bloque()).getByRole('button', { name: 'Importar tareas' }))
    await waitFor(() => expect(api.clickup.importarExistentesClickUp).toHaveBeenCalled())
    expect(argumentoDe(api.clickup.importarExistentesClickUp)).toEqual({ listaId: 'l1', clienteId: 1, tableroId: null })
  })

  it('si la importación falla muestra el error', async () => {
    api.clickup.importarExistentesClickUp.mockRejectedValue(new Error('lista vacía'))
    renderizar(<TarjetaSincronizacion estado={estado(OPERATIVO)} />)
    const lista = within(bloque()).getByLabelText('Lista de ClickUp')
    await waitFor(() => expect(within(lista).getAllByRole('option').length).toBeGreaterThan(1))
    await usuario.selectOptions(lista, 'Innovación y Desarrollo OTC / Backlog Dev')
    await usuario.click(within(bloque()).getByRole('button', { name: 'Importar tareas' }))
    expect(await screen.findByText('lista vacía')).toBeInTheDocument()
  })
})
