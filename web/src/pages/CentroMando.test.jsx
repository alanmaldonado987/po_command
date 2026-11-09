import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../test/apiFalsa'
import { argumentoDe } from '../test/ayudas'
import { crearBloqueante, crearCeremonia, crearItem } from '../test/fabricas'
import { renderizar } from '../test/renderizar'
import CentroMando from './CentroMando'

vi.mock('../api/items', async () => (await import('../test/apiFalsa')).items)
vi.mock('../api/catalogos', async () => (await import('../test/apiFalsa')).catalogos)
vi.mock('../api/alertas', async () => (await import('../test/apiFalsa')).alertas)
vi.mock('../api/correo', async () => (await import('../test/apiFalsa')).correo)
vi.mock('../api/configuracion', async () => (await import('../test/apiFalsa')).configuracion)

const itemsDePrueba = () => [
  crearItem({ id: 1, codigo: 'BL-001', estado: 'Terminado' }),
  crearItem({ id: 2, codigo: 'BL-002', estado: 'En curso', atrasado: true, atraso_dias: 4, fecha_compromiso: '2026-01-01' }),
  crearItem({ id: 3, codigo: 'BL-003', estado: 'Terminado, en etapa de pruebas' }),
  crearItem({ id: 4, codigo: 'BL-004', estado: 'No iniciado' }),
]

beforeEach(() => {
  api.reiniciarApiFalsa()
  api.catalogos.listarCatalogo.mockResolvedValue([
    { id: 1, nombre: 'AIR-E', estado: 'Activo' },
    { id: 2, nombre: 'AFINIA', estado: 'Cerrado' },
  ])
})

const kpi = (etiqueta) => screen.getByText(etiqueta).parentElement

describe('Centro de Mando', () => {
  it('muestra el estado de carga', () => {
    api.items.listarItems.mockReturnValue(new Promise(() => {}))
    renderizar(<CentroMando />)
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })

  it('muestra el error cuando falla la consulta', async () => {
    api.items.listarItems.mockRejectedValue(new Error('RLS denegó el acceso'))
    renderizar(<CentroMando />)
    expect(await screen.findByText(/RLS denegó el acceso/)).toBeInTheDocument()
  })

  it('calcula los KPIs a partir de los datos', async () => {
    api.items.listarItems.mockResolvedValue(itemsDePrueba())
    api.items.listarBloqueantesAbiertos.mockResolvedValue([crearBloqueante({ severidad: 'Alta' })])
    api.alertas.contarAlertas.mockResolvedValue({ pendientes: 3, fallidas: 2, enviadasHoy: 5 })
    renderizar(<CentroMando />)
    await screen.findByRole('heading', { name: 'Centro de Mando' })

    expect(within(kpi('Avance')).getByText('25%')).toBeInTheDocument()
    expect(within(kpi('Avance')).getByText('1 terminados · 1 en pruebas')).toBeInTheDocument()
    expect(within(kpi('Clientes')).getByText('1')).toBeInTheDocument()
    expect(within(kpi('Clientes')).getByText('4 ítems en el plan')).toBeInTheDocument()
    expect(within(kpi('Atrasados')).getByText('de 3 ítems abiertos')).toBeInTheDocument()
    expect(within(kpi('Bloqueantes')).getByText('1 con atraso')).toBeInTheDocument()
    expect(within(kpi('Alertas hoy')).getByText('5')).toBeInTheDocument()
    expect(within(kpi('Alertas hoy')).getByText('2 fallida(s) por revisar')).toBeInTheDocument()
    expect(screen.getByText(/3 alerta\(s\) esperan en cola/)).toBeInTheDocument()
  })

  it('indica si el correo está en simulación o activo', async () => {
    api.items.listarItems.mockResolvedValue([])
    renderizar(<CentroMando />)
    expect(await screen.findByText('Correo en simulación')).toBeInTheDocument()
  })

  it('con datos vacíos muestra los estados vacíos', async () => {
    renderizar(<CentroMando />)
    expect(await screen.findByText('No hay bloqueos abiertos.')).toBeInTheDocument()
    expect(screen.getByText('Nada vence en los próximos 7 días.')).toBeInTheDocument()
    expect(within(kpi('Avance')).getByText('0%')).toBeInTheDocument()
  })

  it('lista los ítems atrasados y por vencer', async () => {
    api.items.listarItems.mockResolvedValue(itemsDePrueba())
    renderizar(<CentroMando />)
    expect(await screen.findByText(/4 día\(s\) de atraso/)).toBeInTheDocument()
  })

  it('muestra la actividad de notificaciones y las próximas alertas', async () => {
    api.alertas.listarProximasAlertas.mockResolvedValue([
      { id: 1, enviar_en: new Date().toISOString(), asunto: '[Vencimientos] Luis', destinatarios: ['luis@ises.com.co'] },
    ])
    api.alertas.listarLog.mockResolvedValue([
      { id: 1, fecha: new Date().toISOString(), regla_codigo: 'BLOQUEO_NUEVO', asunto: '[Bloqueante] BL-001', destinatarios: 'a@b.co', estado: 'Enviada', detalle: '' },
    ])
    renderizar(<CentroMando />)
    expect(await screen.findByText('[Vencimientos] Luis')).toBeInTheDocument()
    expect(await screen.findByText('[Bloqueante] BL-001')).toBeInTheDocument()
  })

  describe('bloqueantes', () => {
    beforeEach(() => {
      api.items.listarBloqueantesAbiertos.mockResolvedValue([
        crearBloqueante({ id: 7, item_id: 42, codigo: 'BL-042', motivo: 'Sin API', escalado_en: null }),
      ])
    })

    it('muestra el bloqueo con motivo y sin escalar', async () => {
      renderizar(<CentroMando />)
      expect(await screen.findByText('Sin API')).toBeInTheDocument()
      expect(screen.getByText(/BL-042/)).toBeInTheDocument()
      expect(screen.getByText('Sin escalar')).toBeInTheDocument()
    })

    it('Escalar llama a la función y avisa con el mensaje devuelto', async () => {
      renderizar(<CentroMando />)
      await userEvent.click(await screen.findByRole('button', { name: /Escalar/ }))
      await waitFor(() => expect(api.alertas.escalarBloqueo).toHaveBeenCalled())
      expect(argumentoDe(api.alertas.escalarBloqueo)).toBe(7)
      expect(await screen.findByText('Escalamiento enviado.')).toBeInTheDocument()
    })

    it('Escalar sin destinatarios muestra un aviso, no un éxito', async () => {
      api.alertas.escalarBloqueo.mockResolvedValue({ ok: false, mensaje: 'No hay destinatarios con correo válido.' })
      renderizar(<CentroMando />)
      await userEvent.click(await screen.findByRole('button', { name: /Escalar/ }))
      const aviso = await screen.findByText('No hay destinatarios con correo válido.')
      expect(aviso.closest('[role=alert]')).toHaveClass('text-warning-ink')
    })

    it('Escalar con error de la función muestra el error', async () => {
      api.alertas.escalarBloqueo.mockRejectedValue(new Error('El bloqueo ya no está abierto'))
      renderizar(<CentroMando />)
      await userEvent.click(await screen.findByRole('button', { name: /Escalar/ }))
      expect(await screen.findByText('El bloqueo ya no está abierto')).toBeInTheDocument()
    })

    it('Resolver desbloquea el ítem y notifica el cambio', async () => {
      const resultado = { id: 42, codigo: 'BL-042', antes: { bloqueado: true }, cambios: [], sin_cambios: false }
      api.items.guardarItem.mockResolvedValue(resultado)
      api.alertas.notificarItemGuardado.mockResolvedValue({ mensaje: 'Bloqueo resuelto: se avisa al equipo.' })
      renderizar(<CentroMando />)
      await userEvent.click(await screen.findByRole('button', { name: /Resolver/ }))
      await waitFor(() => expect(api.items.guardarItem).toHaveBeenCalled())
      expect(argumentoDe(api.items.guardarItem)).toEqual({ datos: { bloqueado: false }, id: 42 })
      expect(argumentoDe(api.alertas.notificarItemGuardado)).toEqual(resultado)
      expect(await screen.findByText('Bloqueo resuelto: se avisa al equipo.')).toBeInTheDocument()
    })

    it('Resolver sin mensaje del servidor usa un texto por defecto', async () => {
      renderizar(<CentroMando />)
      await userEvent.click(await screen.findByRole('button', { name: /Resolver/ }))
      expect(await screen.findByText('Bloqueo resuelto.')).toBeInTheDocument()
    })

    it('Resolver con error lo muestra', async () => {
      api.items.guardarItem.mockRejectedValue(new Error('No tienes permiso'))
      renderizar(<CentroMando />)
      await userEvent.click(await screen.findByRole('button', { name: /Resolver/ }))
      expect(await screen.findByText('No tienes permiso')).toBeInTheDocument()
    })
  })

  describe('aviso de inicio', () => {
    it('no aparece sin aviso configurado', async () => {
      renderizar(<CentroMando />)
      await screen.findByRole('heading', { name: 'Centro de Mando' })
      expect(screen.queryByRole('button', { name: 'Entendido' })).not.toBeInTheDocument()
    })

    it('se descarta con Entendido guardando una cadena vacía', async () => {
      api.configuracion.obtenerConfiguracion.mockResolvedValue({ aviso_inicio: 'Se cargaron 274 ítems.' })
      renderizar(<CentroMando />)
      expect(await screen.findByText('Se cargaron 274 ítems.')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Entendido' }))
      await waitFor(() => expect(api.configuracion.guardarConfiguracion).toHaveBeenCalledWith('aviso_inicio', ''))
    })
  })

  it('no rompe con ceremonias ni otros datos opcionales ausentes', async () => {
    api.items.listarItems.mockResolvedValue([crearItem({ responsable: null, cliente: null })])
    renderizar(<CentroMando />)
    expect(await screen.findByText('Sin asignar')).toBeInTheDocument()
    expect(crearCeremonia()).toBeTruthy()
  })
})
