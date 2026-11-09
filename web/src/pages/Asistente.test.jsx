import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../test/apiFalsa'
import { argumentoDe } from '../test/ayudas'
import { crearBloqueante, crearItem } from '../test/fabricas'
import { renderizar } from '../test/renderizar'
import Asistente from './Asistente'

vi.mock('../api/items', async () => (await import('../test/apiFalsa')).items)
vi.mock('../api/catalogos', async () => (await import('../test/apiFalsa')).catalogos)
vi.mock('../api/personas', async () => (await import('../test/apiFalsa')).personas)
vi.mock('../api/ceremonias', async () => (await import('../test/apiFalsa')).ceremonias)
vi.mock('../api/alertas', async () => (await import('../test/apiFalsa')).alertas)
vi.mock('../api/ia', async () => (await import('../test/apiFalsa')).ia)
vi.mock('../api/configuracion', async () => (await import('../test/apiFalsa')).configuracion)

const usuario = userEvent.setup({ delay: null })

beforeEach(() => {
  api.reiniciarApiFalsa()
  api.catalogos.listarCatalogo.mockResolvedValue([{ id: 1, nombre: 'AIR-E' }])
  api.items.listarItems.mockResolvedValue([
    crearItem({ id: 1, codigo: 'BL-001', cliente_id: 1, cliente: 'AIR-E', atraso_dias: 6, atrasado: true, fecha_compromiso: '2026-10-01' }),
  ])
})

const preguntar = async (texto) => {
  await usuario.type(await screen.findByPlaceholderText(/Pregunta sobre tu backlog/), texto)
  await usuario.click(screen.getByRole('button', { name: 'Enviar' }))
}

describe('Asistente', () => {
  it('muestra carga y error', async () => {
    api.items.listarItems.mockReturnValue(new Promise(() => {}))
    const { unmount } = renderizar(<Asistente />)
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    unmount()
    api.items.listarItems.mockRejectedValue(new Error('sin datos'))
    renderizar(<Asistente />)
    expect(await screen.findByText(/sin datos/)).toBeInTheDocument()
  })

  it('arranca con la bienvenida y la insignia local', async () => {
    renderizar(<Asistente />)
    expect(await screen.findByText(/Hola, soy tu copiloto/)).toBeInTheDocument()
    expect(screen.getByText('Asistente local · sin API key')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '¿Qué está atrasado?' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva conversación' })).not.toBeInTheDocument()
  })

  it('muestra el modelo cuando está disponible', async () => {
    api.ia.obtenerEstadoIa.mockResolvedValue({ disponible: true, modelo: 'llama3.1' })
    renderizar(<Asistente />)
    expect(await screen.findByText('Modelo llama3.1')).toBeInTheDocument()
  })

  it('responde una pregunta escrita con datos de la base', async () => {
    renderizar(<Asistente />)
    await preguntar('¿Qué está atrasado?')
    expect(await screen.findByText(/1 ítem\(s\) atrasados/)).toBeInTheDocument()
    expect(screen.getByText('¿Qué está atrasado?', { selector: 'p, div, span' })).toBeInTheDocument()
    expect(screen.queryByText(/Hola, soy tu copiloto/)).not.toBeInTheDocument()
  })

  it('las preguntas rápidas envían la pregunta', async () => {
    renderizar(<Asistente />)
    await usuario.click(await screen.findByRole('button', { name: '¿Cómo está la carga del equipo?' }))
    expect(await screen.findByText(/Carga del equipo/)).toBeInTheDocument()
  })

  it('no envía mensajes vacíos', async () => {
    renderizar(<Asistente />)
    expect(await screen.findByRole('button', { name: 'Enviar' })).toBeDisabled()
  })

  it('las acciones propuestas se ejecutan al pulsar el botón y muestran el resultado', async () => {
    renderizar(<Asistente />)
    await preguntar('¿Qué está atrasado?')
    await usuario.click(await screen.findByRole('button', { name: /Enviar recordatorio a los responsables \(1\)/ }))
    await waitFor(() => expect(api.alertas.recordarVencimientos).toHaveBeenCalled())
    expect(argumentoDe(api.alertas.recordarVencimientos)).toEqual([1])
    expect(await screen.findByText('1 correo(s) de recordatorio enviados.')).toBeInTheDocument()
  })

  it('escalar un bloqueo usa el id del bloqueante', async () => {
    api.items.listarBloqueantesAbiertos.mockResolvedValue([
      crearBloqueante({ id: 33, item_id: 1, codigo: 'BL-001', cliente_id: 1, abierto_en: new Date(Date.now() - 30 * 3_600_000).toISOString() }),
    ])
    api.alertas.resolverDestinatarios.mockResolvedValue([{ nombre: 'Ana', correo: 'ana@x.co', rol: 'Stakeholder' }])
    renderizar(<Asistente />)
    await preguntar('escala BL-001')
    await usuario.click(await screen.findByRole('button', { name: /Enviar este escalamiento \(1 destinatario\/s\)/ }))
    await waitFor(() => expect(api.alertas.escalarBloqueo).toHaveBeenCalled())
    expect(argumentoDe(api.alertas.escalarBloqueo)).toBe(33)
    expect(await screen.findByText('Escalamiento enviado.')).toBeInTheDocument()
  })

  it('si la acción falla muestra el motivo', async () => {
    api.alertas.recordarVencimientos.mockRejectedValue(new Error('función caída'))
    renderizar(<Asistente />)
    await preguntar('¿Qué está atrasado?')
    await usuario.click(await screen.findByRole('button', { name: /Enviar recordatorio/ }))
    expect(await screen.findByText('No se pudo ejecutar: función caída')).toBeInTheDocument()
  })

  it('con modelo disponible pule la respuesta; si falla usa la local con aviso', async () => {
    api.ia.obtenerEstadoIa.mockResolvedValue({ disponible: true, modelo: 'llama3.1' })
    renderizar(<Asistente />)
    await screen.findByText('Modelo llama3.1')
    await preguntar('¿Qué está atrasado?')
    expect(await screen.findByText('Texto pulido')).toBeInTheDocument()
    expect(argumentoDe(api.ia.redactarConModelo)).toMatchObject({ pregunta: '¿Qué está atrasado?' })

    api.ia.redactarConModelo.mockRejectedValue(new Error('modelo apagado'))
    await preguntar('¿Cómo está la carga del equipo?')
    expect(await screen.findByText(/No pude usar el modelo configurado: modelo apagado/)).toBeInTheDocument()
  })

  it('Nueva conversación limpia el historial', async () => {
    renderizar(<Asistente />)
    await preguntar('¿Qué está atrasado?')
    await screen.findByText(/1 ítem\(s\) atrasados/)
    await usuario.click(screen.getByRole('button', { name: 'Nueva conversación' }))
    expect(screen.queryByText(/1 ítem\(s\) atrasados/)).not.toBeInTheDocument()
    expect(screen.getByText(/Hola, soy tu copiloto/)).toBeInTheDocument()
  })

  it('renderiza negritas y listas del texto del asistente', async () => {
    renderizar(<Asistente />)
    await preguntar('¿Qué está atrasado?')
    const negrita = await screen.findByText('1 ítem(s) atrasados')
    expect(negrita.tagName).toBe('STRONG')
  })
})
