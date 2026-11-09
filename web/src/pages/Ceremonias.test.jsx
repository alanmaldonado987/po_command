import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../test/apiFalsa'
import { argumentoDe } from '../test/ayudas'
import { crearAcuerdo, crearCeremonia, crearItem, crearPersona } from '../test/fabricas'
import { renderizar } from '../test/renderizar'
import Ceremonias from './Ceremonias'

vi.mock('../api/items', async () => (await import('../test/apiFalsa')).items)
vi.mock('../api/catalogos', async () => (await import('../test/apiFalsa')).catalogos)
vi.mock('../api/personas', async () => (await import('../test/apiFalsa')).personas)
vi.mock('../api/ceremonias', async () => (await import('../test/apiFalsa')).ceremonias)
vi.mock('../api/alertas', async () => (await import('../test/apiFalsa')).alertas)

const usuario = userEvent.setup({ delay: null })
const manana = new Date(Date.now() + 86_400_000).toISOString()
const ayer = new Date(Date.now() - 3 * 86_400_000).toISOString()

const demo = crearCeremonia({ id: 1, titulo: 'Demo mensual', tipo: 'Demo', cliente_id: 1, cliente: 'AIR-E', fecha_hora: manana })
const retro = crearCeremonia({ id: 2, titulo: 'Retro pasada', tipo: 'Retro', fecha_hora: ayer, invitacion_enviada: true, cliente_id: null, cliente: null })

beforeEach(() => {
  api.reiniciarApiFalsa()
  api.ceremonias.listarCeremonias.mockResolvedValue([retro, demo])
  api.personas.listarPersonas.mockResolvedValue([crearPersona({ id: 1, nombre: 'Luis Kendor' })])
  api.catalogos.listarCatalogo.mockResolvedValue([{ id: 1, nombre: 'AIR-E' }])
  api.items.listarItems.mockResolvedValue([
    crearItem({ id: 1, cliente_id: 1, estado: 'Terminado, en etapa de pruebas', codigo: 'BL-010', titulo: 'Mapa listo' }),
    crearItem({ id: 2, cliente_id: 1, estado: 'En curso', codigo: 'BL-011', titulo: 'Aún en curso' }),
  ])
  api.alertas.resolverDestinatarios.mockResolvedValue([
    { nombre: 'Ana', correo: 'ana@x.co', rol: 'Equipo' },
    { nombre: 'Vero', correo: 'vero@x.co', rol: 'PO' },
  ])
})

describe('Ceremonias · agenda', () => {
  it('muestra carga y error', async () => {
    api.ceremonias.listarCeremonias.mockReturnValue(new Promise(() => {}))
    const { unmount } = renderizar(<Ceremonias />)
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    unmount()
    api.ceremonias.listarCeremonias.mockRejectedValue(new Error('base caída'))
    renderizar(<Ceremonias />)
    expect(await screen.findByText(/base caída/)).toBeInTheDocument()
  })

  it('muestra solo las próximas y permite ver las pasadas', async () => {
    renderizar(<Ceremonias />)
    expect(await screen.findByText('Demo mensual')).toBeInTheDocument()
    expect(screen.queryByText('Retro pasada')).not.toBeInTheDocument()
    expect(screen.getByText('Sin enviar')).toBeInTheDocument()
    await usuario.click(screen.getByRole('switch', { name: 'Ver pasadas' }))
    expect(await screen.findByText('Retro pasada')).toBeInTheDocument()
    expect(screen.getByText('Invitación enviada')).toBeInTheDocument()
  })

  it('sin ceremonias muestra el estado vacío', async () => {
    api.ceremonias.listarCeremonias.mockResolvedValue([])
    renderizar(<Ceremonias />)
    expect(await screen.findByText('No hay ceremonias próximas.')).toBeInTheDocument()
    expect(screen.getByText(/Elige una ceremonia para ver invitados/)).toBeInTheDocument()
  })
})

describe('Ceremonias · detalle', () => {
  const abrirDemo = async () => {
    renderizar(<Ceremonias />)
    await usuario.click(await screen.findByRole('button', { name: 'Ver detalle' }))
  }

  it('muestra invitados y los ítems listos para la demo', async () => {
    await abrirDemo()
    expect(await screen.findByText('Recibirán la invitación (2):')).toBeInTheDocument()
    expect(screen.getByText(/Ana, Vero/)).toBeInTheDocument()
    expect(screen.getByText('Mapa listo')).toBeInTheDocument()
    expect(screen.queryByText('Aún en curso')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seleccionada' })).toBeDisabled()
  })

  it('consulta los destinatarios con audiencia y categoría', async () => {
    await abrirDemo()
    await screen.findByText('Recibirán la invitación (2):')
    expect(argumentoDe(api.alertas.resolverDestinatarios)).toEqual({
      roles: ['audiencia', 'po'],
      categoria: 'Ceremonias',
      audiencia: 'todos',
    })
  })

  it('sin destinatarios válidos lo indica', async () => {
    api.alertas.resolverDestinatarios.mockResolvedValue([])
    await abrirDemo()
    expect(await screen.findByText(/nadie con correo válido/)).toBeInTheDocument()
  })

  it('envía la invitación e informa a cuántos', async () => {
    await abrirDemo()
    await usuario.click(await screen.findByRole('button', { name: 'Enviar invitación' }))
    await waitFor(() => expect(api.alertas.invitarCeremonia).toHaveBeenCalled())
    expect(argumentoDe(api.alertas.invitarCeremonia)).toBe(1)
    expect(await screen.findByText('Invitación enviada a 3 persona(s).')).toBeInTheDocument()
  })

  it('si la invitación falla muestra el error', async () => {
    api.alertas.invitarCeremonia.mockRejectedValue(new Error('Failed to send a request to the Edge Function'))
    await abrirDemo()
    await usuario.click(await screen.findByRole('button', { name: 'Enviar invitación' }))
    expect(await screen.findByText('Failed to send a request to the Edge Function')).toBeInTheDocument()
  })

  it('elimina la ceremonia y cierra el detalle', async () => {
    await abrirDemo()
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar ceremonia' }))
    await waitFor(() => expect(api.ceremonias.eliminarCeremonia).toHaveBeenCalled())
    expect(argumentoDe(api.ceremonias.eliminarCeremonia)).toBe(1)
    expect(await screen.findByText('Ceremonia eliminada y sus recordatorios cancelados.')).toBeInTheDocument()
    expect(screen.getByText(/Elige una ceremonia para ver invitados/)).toBeInTheDocument()
  })

  it('si no se puede eliminar muestra el error', async () => {
    api.ceremonias.eliminarCeremonia.mockRejectedValue(new Error('no autorizado'))
    await abrirDemo()
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar ceremonia' }))
    expect(await screen.findByText('no autorizado')).toBeInTheDocument()
  })
})

describe('Ceremonias · formulario', () => {
  const abrirNueva = async () => {
    renderizar(<Ceremonias />)
    await usuario.click(await screen.findByRole('button', { name: /Agendar/ }))
  }

  it('exige el título', async () => {
    await abrirNueva()
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('El título es obligatorio.')).toBeInTheDocument()
    expect(api.ceremonias.guardarCeremonia).not.toHaveBeenCalled()
  })

  it('crea una ceremonia con fecha y hora en ISO', async () => {
    await abrirNueva()
    await usuario.type(screen.getByLabelText('Título *'), '  Planning  ')
    await usuario.selectOptions(screen.getByLabelText('Tipo'), 'Planning')
    await usuario.selectOptions(screen.getByLabelText('Cliente'), 'AIR-E')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.ceremonias.guardarCeremonia).toHaveBeenCalled())
    const { datos, id } = argumentoDe(api.ceremonias.guardarCeremonia)
    expect(id).toBeNull()
    expect(datos).toMatchObject({ titulo: 'Planning', tipo: 'Planning', cliente_id: 1, duracion_min: 60, lugar: 'Teams', audiencia: 'equipo' })
    expect(datos.fecha_hora).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$/)
    expect(await screen.findByText(/Ceremonia guardada/)).toBeInTheDocument()
  })

  it('edita una ceremonia existente', async () => {
    renderizar(<Ceremonias />)
    await usuario.click(await screen.findByRole('button', { name: 'Ver detalle' }))
    const formulario = (await screen.findByText('Editar ceremonia')).closest('section')
    const titulo = within(formulario).getByLabelText('Título *')
    expect(titulo).toHaveValue('Demo mensual')
    await usuario.clear(titulo)
    await usuario.type(titulo, 'Demo trimestral')
    await usuario.click(within(formulario).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.ceremonias.guardarCeremonia).toHaveBeenCalled())
    expect(argumentoDe(api.ceremonias.guardarCeremonia)).toMatchObject({ id: 1, datos: { titulo: 'Demo trimestral' } })
  })

  it('si el servidor rechaza el guardado muestra el error', async () => {
    api.ceremonias.guardarCeremonia.mockRejectedValue(new Error('fecha inválida'))
    await abrirNueva()
    await usuario.type(screen.getByLabelText('Título *'), 'Retro')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('fecha inválida')).toBeInTheDocument()
  })
})

describe('Ceremonias · acuerdos', () => {
  beforeEach(() => {
    api.ceremonias.listarAcuerdos.mockResolvedValue([crearAcuerdo({ id: 10, descripcion: 'Enviar acta', responsable_id: 1 })])
  })

  const tarjetaAcuerdos = async () => (await screen.findByText('Acuerdos y compromisos')).closest('section')

  it('lista los acuerdos existentes', async () => {
    renderizar(<Ceremonias />)
    const tarjeta = await tarjetaAcuerdos()
    expect(within(tarjeta).getByDisplayValue('Enviar acta')).toBeInTheDocument()
  })

  it('agrega una fila nueva y guarda solo las que tienen descripción', async () => {
    renderizar(<Ceremonias />)
    const tarjeta = await tarjetaAcuerdos()
    await usuario.click(within(tarjeta).getByRole('button', { name: 'Agregar acuerdo' }))
    await usuario.click(within(tarjeta).getByRole('button', { name: 'Agregar acuerdo' }))
    const descripciones = within(tarjeta).getAllByLabelText('Acuerdo')
    expect(descripciones).toHaveLength(3)
    await usuario.type(descripciones[1], '  Revisar presupuesto ')
    await usuario.click(within(tarjeta).getByRole('button', { name: 'Guardar acuerdos' }))
    await waitFor(() => expect(api.ceremonias.guardarAcuerdo).toHaveBeenCalledTimes(2))
    const guardados = api.ceremonias.guardarAcuerdo.mock.calls.map(([arg]) => arg)
    expect(guardados).toContainEqual(expect.objectContaining({ id: 10 }))
    expect(guardados).toContainEqual(
      expect.objectContaining({ id: null, datos: expect.objectContaining({ descripcion: 'Revisar presupuesto', estado: 'Pendiente' }) }),
    )
    expect(await screen.findByText('Acuerdos guardados.')).toBeInTheDocument()
  })

  it('quitar un acuerdo existente lo elimina al guardar', async () => {
    renderizar(<Ceremonias />)
    const tarjeta = await tarjetaAcuerdos()
    await usuario.click(within(tarjeta).getByRole('button', { name: 'Quitar acuerdo' }))
    expect(api.ceremonias.eliminarAcuerdo).not.toHaveBeenCalled()
    await usuario.click(within(tarjeta).getByRole('button', { name: 'Guardar acuerdos' }))
    await waitFor(() => expect(api.ceremonias.eliminarAcuerdo).toHaveBeenCalled())
    expect(argumentoDe(api.ceremonias.eliminarAcuerdo)).toBe(10)
    expect(api.ceremonias.guardarAcuerdo).not.toHaveBeenCalled()
  })

  it('sin acuerdos muestra el estado vacío', async () => {
    api.ceremonias.listarAcuerdos.mockResolvedValue([])
    renderizar(<Ceremonias />)
    expect(await screen.findByText('No hay acuerdos registrados.')).toBeInTheDocument()
  })

  it('si el guardado falla muestra el error', async () => {
    api.ceremonias.guardarAcuerdo.mockRejectedValue(new Error('RLS rechazó la escritura'))
    renderizar(<Ceremonias />)
    const tarjeta = await tarjetaAcuerdos()
    await usuario.click(within(tarjeta).getByRole('button', { name: 'Guardar acuerdos' }))
    expect(await screen.findByText('RLS rechazó la escritura')).toBeInTheDocument()
  })
})
