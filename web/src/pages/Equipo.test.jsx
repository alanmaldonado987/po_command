import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../test/apiFalsa'
import { argumentoDe } from '../test/ayudas'
import { crearItem, crearPersona } from '../test/fabricas'
import { renderizar } from '../test/renderizar'
import Equipo from './Equipo'

vi.mock('../api/items', async () => (await import('../test/apiFalsa')).items)
vi.mock('../api/catalogos', async () => (await import('../test/apiFalsa')).catalogos)
vi.mock('../api/personas', async () => (await import('../test/apiFalsa')).personas)
vi.mock('../api/clickup', async () => (await import('../test/apiFalsa')).clickup)

const usuario = userEvent.setup({ delay: null })

const ana = crearPersona({ id: 1, nombre: 'Ana Gómez', rol: 'Developer', tipo: 'equipo', correo: 'ana@ises.com.co', cliente_ids: [1], clientes: 'AIR-E' })
const beto = crearPersona({ id: 2, nombre: 'Beto Ruiz', rol: 'QA', tipo: 'equipo', correo: '', activo: false })
const carla = crearPersona({ id: 3, nombre: 'Carla Soto', rol: 'Gerente', tipo: 'stakeholder', correo: 'carla@aire.co', frecuencia_reporte: 'Mensual', clientes: 'AIR-E' })

beforeEach(() => {
  api.reiniciarApiFalsa()
  api.personas.listarPersonas.mockResolvedValue([ana, beto, carla])
  api.catalogos.listarCatalogo.mockResolvedValue([{ id: 1, nombre: 'AIR-E' }, { id: 2, nombre: 'AFINIA' }])
  api.items.listarItems.mockResolvedValue([
    crearItem({ responsable_id: 1, atrasado: true }),
    crearItem({ responsable_id: 1 }),
    crearItem({ responsable_id: 2, estado: 'Terminado' }),
  ])
})

describe('Equipo', () => {
  it('muestra carga y error', async () => {
    api.personas.listarPersonas.mockReturnValue(new Promise(() => {}))
    const { unmount } = renderizar(<Equipo />)
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    unmount()
    api.personas.listarPersonas.mockRejectedValue(new Error('sin acceso'))
    renderizar(<Equipo />)
    expect(await screen.findByText(/sin acceso/)).toBeInTheDocument()
  })

  it('lista al equipo con su carga y avisa de quien no tiene correo', async () => {
    renderizar(<Equipo />)
    expect(await screen.findByText('Ana Gómez')).toBeInTheDocument()
    expect(screen.getByText('2 · 1 atrasados')).toBeInTheDocument()
    expect(screen.getByText('Beto Ruiz')).toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
    expect(screen.getByText('Falta correo válido')).toBeInTheDocument()
    expect(screen.getByText('1 persona(s) sin correo válido: sus alertas se redirigen al PO.')).toBeInTheDocument()
    expect(screen.queryByText('Carla Soto')).not.toBeInTheDocument()
  })

  it('cambia a stakeholders y muestra su frecuencia de reporte', async () => {
    renderizar(<Equipo />)
    await screen.findByText('Ana Gómez')
    await usuario.click(screen.getByRole('button', { name: 'Stakeholders' }))
    expect(await screen.findByText('Carla Soto')).toBeInTheDocument()
    expect(screen.getByText('Mensual')).toBeInTheDocument()
    expect(screen.queryByText('Ana Gómez')).not.toBeInTheDocument()
  })

  it('busca por nombre, rol o cliente', async () => {
    renderizar(<Equipo />)
    await screen.findByText('Ana Gómez')
    await usuario.type(screen.getByLabelText(/Buscar/), 'qa')
    expect(await screen.findByText('Beto Ruiz')).toBeInTheDocument()
    expect(screen.queryByText('Ana Gómez')).not.toBeInTheDocument()
    await usuario.clear(screen.getByLabelText(/Buscar/))
    await usuario.type(screen.getByLabelText(/Buscar/), 'zzz')
    expect(await screen.findByText('No hay personas que coincidan.')).toBeInTheDocument()
  })

  describe('crear y editar', () => {
    it('valida que el nombre sea obligatorio', async () => {
      renderizar(<Equipo />)
      await usuario.click(await screen.findByRole('button', { name: /Agregar persona/ }))
      await usuario.click(screen.getByRole('button', { name: 'Agregar' }))
      expect(await screen.findByText('El nombre es obligatorio.')).toBeInTheDocument()
      expect(api.personas.guardarPersona).not.toHaveBeenCalled()
    })

    it('agrega una persona con categorías y clientes elegidos', async () => {
      renderizar(<Equipo />)
      await usuario.click(await screen.findByRole('button', { name: /Agregar persona/ }))
      await usuario.type(screen.getByLabelText('Nombre completo *'), '  Dora Pérez ')
      await usuario.type(screen.getByLabelText('Correo'), 'dora@ises.com')
      await usuario.click(screen.getByRole('button', { name: 'Ceremonias' }))
      await usuario.click(screen.getByRole('button', { name: 'Resumen semanal' }))
      await usuario.click(screen.getByRole('button', { name: 'Agregar' }))

      await waitFor(() => expect(api.personas.guardarPersona).toHaveBeenCalled())
      expect(argumentoDe(api.personas.guardarPersona)).toEqual({
        datos: {
          nombre: 'Dora Pérez',
          correo: 'dora@ises.com',
          tipo: 'equipo',
          rol: '',
          frecuencia_reporte: '',
          recibe: ['Bloqueantes', 'Vencimientos', 'Resumen semanal'],
          activo: true,
          tablero_id: null,
        },
        clienteIds: [],
        id: null,
      })
      expect(await screen.findByText(/Dora Pérez agregado al directorio\./)).toBeInTheDocument()
    })

    it('advierte cuando el correo no parece válido', async () => {
      renderizar(<Equipo />)
      await usuario.click(await screen.findByRole('button', { name: /Agregar persona/ }))
      await usuario.type(screen.getByLabelText('Nombre completo *'), 'Eli')
      await usuario.type(screen.getByLabelText('Correo'), 'no-es-correo')
      await usuario.click(screen.getByRole('button', { name: 'Agregar' }))
      expect(await screen.findByText(/el correo no parece válido; sus alertas irán al PO/)).toBeInTheDocument()
    })

    it('abre el editor con los datos de la persona y guarda con su id', async () => {
      renderizar(<Equipo />)
      const ficha = (await screen.findByText('Ana Gómez')).closest('article')
      await usuario.click(within(ficha).getByRole('button', { name: 'Editar' }))
      expect(await screen.findByText('Editar a Ana Gómez')).toBeInTheDocument()
      expect(screen.getByLabelText('Correo')).toHaveValue('ana@ises.com.co')
      await usuario.clear(screen.getByLabelText(/^Rol/))
      await usuario.type(screen.getByLabelText(/^Rol/), 'Líder técnico')
      await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))
      await waitFor(() => expect(api.personas.guardarPersona).toHaveBeenCalled())
      expect(argumentoDe(api.personas.guardarPersona)).toMatchObject({ id: 1, clienteIds: [1], datos: { rol: 'Líder técnico' } })
      expect(await screen.findByText(/Ana Gómez actualizado\./)).toBeInTheDocument()
    })

    it('muestra un error si el servidor rechaza el guardado', async () => {
      api.personas.guardarPersona.mockRejectedValue(new Error('permiso denegado'))
      renderizar(<Equipo />)
      await usuario.click(await screen.findByRole('button', { name: /Agregar persona/ }))
      await usuario.type(screen.getByLabelText('Nombre completo *'), 'Fer')
      await usuario.click(screen.getByRole('button', { name: 'Agregar' }))
      expect(await screen.findByText('permiso denegado')).toBeInTheDocument()
    })

    it('Cerrar descarta el editor', async () => {
      renderizar(<Equipo />)
      await usuario.click(await screen.findByRole('button', { name: /Agregar persona/ }))
      await usuario.click(screen.getByRole('button', { name: 'Cerrar' }))
      expect(screen.queryByText('Nueva persona')).not.toBeInTheDocument()
    })
  })

  describe('eliminar', () => {
    async function abrirEdicionDeAna() {
      renderizar(<Equipo />)
      const ficha = (await screen.findByText('Ana Gómez')).closest('article')
      await usuario.click(within(ficha).getByRole('button', { name: 'Editar' }))
      await usuario.click(await screen.findByRole('button', { name: 'Eliminar persona' }))
    }

    it('pide confirmación con los ítems abiertos afectados', async () => {
      await abrirEdicionDeAna()
      expect(screen.getByText(/sus 2 ítem\(s\) abiertos quedarán sin responsable/)).toBeInTheDocument()
      expect(api.personas.eliminarPersona).not.toHaveBeenCalled()
    })

    it('elimina al confirmar', async () => {
      await abrirEdicionDeAna()
      await usuario.click(screen.getByRole('button', { name: 'Sí, eliminar' }))
      await waitFor(() => expect(api.personas.eliminarPersona).toHaveBeenCalled())
      expect(argumentoDe(api.personas.eliminarPersona)).toBe(1)
      expect(await screen.findByText('Ana Gómez eliminado del directorio.')).toBeInTheDocument()
    })

    it('Cancelar no elimina', async () => {
      await abrirEdicionDeAna()
      await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
      expect(api.personas.eliminarPersona).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Eliminar persona' })).toBeInTheDocument()
    })

    it('muestra el error si la base no permite eliminar', async () => {
      api.personas.eliminarPersona.mockRejectedValue(new Error('violates foreign key'))
      await abrirEdicionDeAna()
      await usuario.click(screen.getByRole('button', { name: 'Sí, eliminar' }))
      expect(await screen.findByText('violates foreign key')).toBeInTheDocument()
    })
  })
})
