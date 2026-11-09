import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../test/apiFalsa'
import { argumentoDe } from '../test/ayudas'
import { crearPersona, crearRegla } from '../test/fabricas'
import { renderizar } from '../test/renderizar'
import Alertas from './Alertas'

vi.mock('../api/alertas', async () => (await import('../test/apiFalsa')).alertas)
vi.mock('../api/correo', async () => (await import('../test/apiFalsa')).correo)
vi.mock('../api/personas', async () => (await import('../test/apiFalsa')).personas)
vi.mock('../api/configuracion', async () => (await import('../test/apiFalsa')).configuracion)

const usuario = userEvent.setup({ delay: null })

const vencimiento = crearRegla({ id: 1, codigo: 'VENCIMIENTO', nombre: 'Vencimiento de fecha planificada', parametro: 2, hora_envio: '08:00' })
const bloqueo = crearRegla({
  id: 2, codigo: 'BLOQUEO_NUEVO', nombre: 'Nuevo bloqueante', categoria: 'Bloqueantes', destinatarios: ['responsable', 'po'],
  parametro: 0, hora_envio: '00:00', activa: false,
})
const configLista = { ...api.CONFIG_CORREO_BASE, configurado: true, usuario: 'vero@ises.com.co', remitente: 'vero@ises.com.co', password_guardada: true }

beforeEach(() => {
  api.reiniciarApiFalsa()
  api.alertas.listarReglas.mockResolvedValue([vencimiento, bloqueo])
  api.personas.listarPersonas.mockResolvedValue([crearPersona({ nombre: 'Ana', correo: 'ana@empresa.co' }), crearPersona({ nombre: 'Beto', correo: '' })])
})

const tarjeta = (titulo) => screen.getByText(titulo).closest('section, article')

describe('Alertas · página', () => {
  it('muestra carga y error', async () => {
    api.alertas.listarReglas.mockReturnValue(new Promise(() => {}))
    const { unmount } = renderizar(<Alertas />)
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    unmount()
    api.alertas.listarReglas.mockRejectedValue(new Error('sin permisos'))
    renderizar(<Alertas />)
    expect(await screen.findByText(/sin permisos/)).toBeInTheDocument()
  })

  it('muestra insignia, KPIs y reglas', async () => {
    api.alertas.contarAlertas.mockResolvedValue({ pendientes: 6, fallidas: 1, enviadasHoy: 9 })
    renderizar(<Alertas />)
    expect(await screen.findByText('Correo en simulación')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(await screen.findByText('9')).toBeInTheDocument()
    expect(screen.getByText('Vencimiento de fecha planificada')).toBeInTheDocument()
    expect(screen.getByText(/2 días antes · 08:00/)).toBeInTheDocument()
    expect(screen.getByText('Nuevo bloqueante')).toBeInTheDocument()
  })

  it('indica SMTP activo cuando el envío real está habilitado', async () => {
    api.correo.obtenerConfigCorreo.mockResolvedValue({ ...configLista, dry_run: false })
    renderizar(<Alertas />)
    expect(await screen.findByText('SMTP activo')).toBeInTheDocument()
    expect(screen.getByText('Envío real activo')).toBeInTheDocument()
  })

  it('Revisar reglas muestra el resumen de la revisión', async () => {
    renderizar(<Alertas />)
    await usuario.click(await screen.findByRole('button', { name: /Revisar reglas y enviar ahora/ }))
    expect(await screen.findByText('Revisión completa: 1 alerta(s) nuevas, 2 enviada(s), 0 fallida(s).')).toBeInTheDocument()
  })

  it('Revisar reglas muestra el error si la función falla', async () => {
    api.alertas.revisarReglasAhora.mockRejectedValue(new Error('Failed to send a request to the Edge Function'))
    renderizar(<Alertas />)
    await usuario.click(await screen.findByRole('button', { name: /Revisar reglas y enviar ahora/ }))
    expect(await screen.findByText('Failed to send a request to the Edge Function')).toBeInTheDocument()
  })
})

describe('Alertas · reglas', () => {
  it('el interruptor activa o desactiva la regla', async () => {
    renderizar(<Alertas />)
    await screen.findByText('Nuevo bloqueante')
    const interruptores = screen.getAllByRole('switch', { name: 'Activa' })
    await usuario.click(interruptores[1])
    await waitFor(() => expect(api.alertas.actualizarRegla).toHaveBeenCalled())
    expect(api.alertas.actualizarRegla.mock.calls[0].slice(0, 2)).toEqual([2, { activa: true }])
    await usuario.click(interruptores[0])
    await waitFor(() => expect(api.alertas.actualizarRegla).toHaveBeenCalledTimes(2))
    expect(api.alertas.actualizarRegla.mock.calls[1].slice(0, 2)).toEqual([1, { activa: false }])
  })

  it('Ajustar guarda destinatarios, parámetro y hora', async () => {
    renderizar(<Alertas />)
    await screen.findByText('Vencimiento de fecha planificada')
    await usuario.click(within(tarjeta('Vencimiento de fecha planificada')).getByRole('button', { name: 'Ajustar' }))
    await usuario.click(screen.getByRole('button', { name: 'Product Owner' }))
    const parametro = screen.getByLabelText('Parámetro (días antes)')
    await usuario.clear(parametro)
    await usuario.type(parametro, '5')
    const hora = screen.getByLabelText('Hora de envío (HH:MM)')
    await usuario.clear(hora)
    await usuario.type(hora, '09:30')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.alertas.actualizarRegla).toHaveBeenCalled())
    expect(api.alertas.actualizarRegla.mock.calls[0].slice(0, 2)).toEqual([
      1,
      { destinatarios: ['responsable', 'po'], parametro: 5, hora_envio: '09:30' },
    ])
    expect(await screen.findByText('Regla «Vencimiento de fecha planificada» actualizada.')).toBeInTheDocument()
  })

  it('una hora inválida vuelve a 08:00', async () => {
    renderizar(<Alertas />)
    await screen.findByText('Vencimiento de fecha planificada')
    await usuario.click(within(tarjeta('Vencimiento de fecha planificada')).getByRole('button', { name: 'Ajustar' }))
    const hora = screen.getByLabelText('Hora de envío (HH:MM)')
    await usuario.clear(hora)
    await usuario.type(hora, '25:99')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.alertas.actualizarRegla).toHaveBeenCalled())
    expect(api.alertas.actualizarRegla.mock.calls[0][1]).toMatchObject({ hora_envio: '08:00' })
  })

  it('si el guardado falla informa y no cierra con éxito', async () => {
    api.alertas.actualizarRegla.mockRejectedValue(new Error('RLS rechazó el cambio'))
    renderizar(<Alertas />)
    await screen.findByText('Vencimiento de fecha planificada')
    await usuario.click(within(tarjeta('Vencimiento de fecha planificada')).getByRole('button', { name: 'Ajustar' }))
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('RLS rechazó el cambio')).toBeInTheDocument()
    expect(screen.queryByText(/actualizada\./)).not.toBeInTheDocument()
  })
})

describe('Alertas · cola de envíos', () => {
  const alerta = (id, extra = {}) => ({
    id, enviar_en: '2026-11-07T13:00:00Z', regla_codigo: 'VENCIMIENTO', asunto: `Asunto ${id}`,
    destinatarios: ['a@b.co', 'c@d.co'], intentos: 0, error: null, ...extra,
  })

  beforeEach(() => api.alertas.listarCola.mockImplementation(async (estado) => (estado === 'Pendiente' ? [alerta(1), alerta(2)] : [alerta(3, { error: 'SMTP rechazó', intentos: 3 })])))

  it('lista los pendientes y vacío en otros estados', async () => {
    renderizar(<Alertas />)
    expect(await screen.findByText('Asunto 1')).toBeInTheDocument()
    expect(screen.getAllByText('a@b.co, c@d.co')).toHaveLength(2)
    api.alertas.listarCola.mockResolvedValue([])
    await usuario.click(screen.getByRole('button', { name: 'Enviada' }))
    expect(await screen.findByText('Sin registros en este estado.')).toBeInTheDocument()
  })

  it('con una fila seleccionada muestra la vista previa del correo', async () => {
    renderizar(<Alertas />)
    await usuario.click(await screen.findByText('Asunto 1'))
    const vista = await screen.findByTitle('Vista previa del correo')
    expect(vista).toHaveAttribute('sandbox', '')
    await waitFor(() => expect(vista).toHaveAttribute('srcdoc', '<p>Vista previa</p>'))
    expect(argumentoDe(api.alertas.obtenerCuerpoAlerta)).toBe(1)
  })

  it('con varias filas pide seleccionar una sola para la vista previa', async () => {
    renderizar(<Alertas />)
    await usuario.click(await screen.findByText('Asunto 1'))
    await usuario.click(screen.getByText('Asunto 2'))
    expect(screen.queryByTitle('Vista previa del correo')).not.toBeInTheDocument()
    expect(screen.getByText(/Selecciona una fila para ver la vista previa/)).toBeInTheDocument()
  })

  it('Cancelar seleccionadas envía los ids', async () => {
    renderizar(<Alertas />)
    expect(await screen.findByRole('button', { name: 'Cancelar seleccionadas' })).toBeDisabled()
    await usuario.click(screen.getByText('Asunto 1'))
    await usuario.click(screen.getByText('Asunto 2'))
    await usuario.click(screen.getByRole('button', { name: 'Cancelar seleccionadas' }))
    await waitFor(() => expect(api.alertas.cancelarAlertas).toHaveBeenCalled())
    expect(argumentoDe(api.alertas.cancelarAlertas)).toEqual([1, 2])
  })

  it('si cancelar falla muestra el error', async () => {
    api.alertas.cancelarAlertas.mockRejectedValue(new Error('no se pudo cancelar'))
    renderizar(<Alertas />)
    await usuario.click(await screen.findByText('Asunto 1'))
    await usuario.click(screen.getByRole('button', { name: 'Cancelar seleccionadas' }))
    expect(await screen.findByText('no se pudo cancelar')).toBeInTheDocument()
  })

  it('Reintentar solo existe en Fallida o Cancelada y reporta el resultado', async () => {
    api.alertas.despacharCola.mockResolvedValue({ enviadas: 0, fallidas: 1 })
    renderizar(<Alertas />)
    await screen.findByText('Asunto 1')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Fallida' }))
    await usuario.click(await screen.findByText('Asunto 3'))
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(api.alertas.reintentarAlertas).toHaveBeenCalled())
    expect(argumentoDe(api.alertas.reintentarAlertas)).toEqual([3])
    expect(await screen.findByText('Reintento: 0 enviada(s), 1 fallida(s).')).toBeInTheDocument()
  })

  it('el historial muestra las notificaciones', async () => {
    api.alertas.listarLog.mockResolvedValue([
      { id: 1, fecha: '2026-11-06T14:00:00Z', regla_codigo: 'BLOQUEO_NUEVO', asunto: 'Asunto del log', destinatarios: 'x@y.co', estado: 'Fallida', detalle: 'timeout' },
    ])
    renderizar(<Alertas />)
    expect(await screen.findByText('Asunto del log')).toBeInTheDocument()
    expect(screen.getByText('timeout')).toBeInTheDocument()
  })
})

describe('Alertas · envío de correos', () => {
  it('al elegir Gmail completa servidor, puerto y seguridad', async () => {
    renderizar(<Alertas />)
    await usuario.click(await screen.findByRole('button', { name: 'Gmail / Google Workspace' }))
    await usuario.click(screen.getByText('Servidor (avanzado)'))
    expect(screen.getByLabelText('Servidor SMTP')).toHaveValue('smtp.gmail.com')
    expect(screen.getByLabelText('Puerto')).toHaveValue(587)
  })

  it('guarda sin contraseña si queda vacía y prueba la conexión', async () => {
    api.correo.obtenerConfigCorreo.mockResolvedValue(configLista)
    renderizar(<Alertas />)
    expect(await screen.findByPlaceholderText('•••••••• (guardada)')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Guardar y probar conexión' }))
    await waitFor(() => expect(api.correo.guardarConfigCorreo).toHaveBeenCalled())
    const valores = argumentoDe(api.correo.guardarConfigCorreo)
    expect(valores).toMatchObject({ usuario: 'vero@ises.com.co', host: 'smtp.office365.com', puerto: 587, seguridad: 'starttls' })
    expect(valores).not.toHaveProperty('password')
    expect(await screen.findByText('Conexión correcta.')).toBeInTheDocument()
  })

  it('envía la contraseña cuando se escribe una nueva', async () => {
    renderizar(<Alertas />)
    await usuario.type(await screen.findByLabelText(/^Contraseña o contraseña de aplicación/), 'clave-app')
    await usuario.click(screen.getByRole('button', { name: 'Guardar y probar conexión' }))
    await waitFor(() => expect(api.correo.guardarConfigCorreo).toHaveBeenCalled())
    expect(argumentoDe(api.correo.guardarConfigCorreo).password).toBe('clave-app')
  })

  it('muestra la explicación y el detalle cuando la conexión falla', async () => {
    api.correo.probarConexionCorreo.mockResolvedValue({ ok: false, explicacion: 'Usuario o contraseña rechazados.', detalle: '535 Authentication failed' })
    renderizar(<Alertas />)
    await usuario.click(await screen.findByRole('button', { name: 'Guardar y probar conexión' }))
    expect(await screen.findByText(/Usuario o contraseña rechazados\./)).toBeInTheDocument()
    expect(screen.getByText(/Detalle: 535 Authentication failed/)).toBeInTheDocument()
  })

  it('si la función no responde lo informa en lugar de fallar en silencio', async () => {
    api.correo.guardarConfigCorreo.mockRejectedValue(new Error('Failed to send a request to the Edge Function'))
    renderizar(<Alertas />)
    await usuario.click(await screen.findByRole('button', { name: 'Guardar y probar conexión' }))
    expect(await screen.findByText(/Detalle: Failed to send a request to the Edge Function/)).toBeInTheDocument()
  })

  describe('activación del envío real', () => {
    beforeEach(() => api.correo.obtenerConfigCorreo.mockResolvedValue(configLista))

    it('no aparece mientras el correo no esté configurado', async () => {
      api.correo.obtenerConfigCorreo.mockResolvedValue(api.CONFIG_CORREO_BASE)
      renderizar(<Alertas />)
      await screen.findByText('Guardar y probar conexión')
      expect(screen.queryByText('Enviar prueba')).not.toBeInTheDocument()
    })

    it('el envío real solo se habilita tras una prueba exitosa y la confirmación', async () => {
      renderizar(<Alertas />)
      const activar = await screen.findByRole('button', { name: 'Activar envío real' })
      expect(activar).toBeDisabled()
      const casilla = screen.getByRole('checkbox')
      expect(casilla).toBeDisabled()

      await usuario.click(screen.getByRole('button', { name: 'Enviar prueba' }))
      expect(await screen.findByText(/Enviado\./)).toBeInTheDocument()
      expect(argumentoDe(api.correo.enviarCorreoPrueba)).toBe('vero@ises.com.co')
      expect(casilla).toBeEnabled()
      expect(activar).toBeDisabled()
      await usuario.click(casilla)
      expect(activar).toBeEnabled()

      await usuario.click(activar)
      await waitFor(() => expect(api.correo.cambiarModoEnvio).toHaveBeenCalled())
      expect(argumentoDe(api.correo.cambiarModoEnvio)).toBe(false)
      expect(await screen.findByText('Envío real activado: las próximas alertas saldrán por correo.')).toBeInTheDocument()
    })

    it('una prueba fallida mantiene el botón bloqueado', async () => {
      api.correo.enviarCorreoPrueba.mockResolvedValue({ ok: false, explicacion: 'No hay conexión.', detalle: 'timeout' })
      renderizar(<Alertas />)
      await usuario.click(await screen.findByRole('button', { name: 'Enviar prueba' }))
      expect(await screen.findByText(/No hay conexión\./)).toBeInTheDocument()
      expect(screen.getByRole('checkbox')).toBeDisabled()
    })

    it('si la función de correo cae muestra el error de la prueba', async () => {
      api.correo.enviarCorreoPrueba.mockRejectedValue(new Error('función no disponible'))
      renderizar(<Alertas />)
      await usuario.click(await screen.findByRole('button', { name: 'Enviar prueba' }))
      expect(await screen.findByText(/función no disponible/)).toBeInTheDocument()
    })

    it('avisa de correos de ejemplo y de personas sin correo', async () => {
      renderizar(<Alertas />)
      expect(await screen.findByText(/1 persona\(s\) tienen el correo de ejemplo @empresa\.co \(Ana\)/)).toBeInTheDocument()
      expect(screen.getByText('1 persona(s) sin correo: sus alertas te llegarán a ti.')).toBeInTheDocument()
    })

    it('en envío real permite volver a simulación', async () => {
      api.correo.obtenerConfigCorreo.mockResolvedValue({ ...configLista, dry_run: false })
      renderizar(<Alertas />)
      await usuario.click(await screen.findByRole('button', { name: 'Volver a modo simulación' }))
      await waitFor(() => expect(api.correo.cambiarModoEnvio).toHaveBeenCalled())
      expect(argumentoDe(api.correo.cambiarModoEnvio)).toBe(true)
      expect(await screen.findByText('Modo simulación activado: no saldrán correos reales.')).toBeInTheDocument()
    })

    it('si el cambio de modo falla lo informa', async () => {
      api.correo.obtenerConfigCorreo.mockResolvedValue({ ...configLista, dry_run: false })
      api.correo.cambiarModoEnvio.mockRejectedValue(new Error('sin permisos'))
      renderizar(<Alertas />)
      await usuario.click(await screen.findByRole('button', { name: 'Volver a modo simulación' }))
      expect(await screen.findByText('sin permisos')).toBeInTheDocument()
    })
  })
})
