import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearBase, escalar, filas, unaFila } from './helpers/baseDeDatos.js'

const CODIGOS_REGLAS = [
  'ACUERDO_VENCIDO',
  'BLOQUEO_ESCALAR',
  'BLOQUEO_NUEVO',
  'BLOQUEO_RESUELTO',
  'CEREMONIA',
  'REPROGRAMACION',
  'RESUMEN_SEMANAL',
  'VENCIMIENTO',
]

describe('semillas', () => {
  let base

  beforeEach(async () => {
    base = await crearBase()
  })
  afterEach(() => base.close())

  it('crea las 8 reglas de alerta, todas activas', async () => {
    const reglas = await filas(base, 'select codigo, activa from public.regla_alerta order by codigo')
    expect(reglas.map((r) => r.codigo)).toEqual(CODIGOS_REGLAS)
    expect(reglas.every((r) => r.activa)).toBe(true)
  })

  it.each([
    ['BLOQUEO_ESCALAR', 48, ['stakeholders', 'lider_tecnico', 'po']],
    ['VENCIMIENTO', 2, ['responsable']],
    ['CEREMONIA', 24, ['audiencia']],
    ['RESUMEN_SEMANAL', 0, ['po', 'stakeholders']],
  ])('configura la regla %s con su parámetro y destinatarios', async (codigo, parametro, destinatarios) => {
    const regla = await unaFila(base, 'select parametro::int as parametro, destinatarios from public.regla_alerta where codigo = $1', [codigo])
    expect(regla).toEqual({ parametro, destinatarios })
  })

  it('programa el resumen semanal a las 07:30 y los vencimientos a las 08:00', async () => {
    expect(await escalar(base, `select hora_envio from public.regla_alerta where codigo = 'RESUMEN_SEMANAL'`)).toBe('07:30')
    expect(await escalar(base, `select hora_envio from public.regla_alerta where codigo = 'VENCIMIENTO'`)).toBe('08:00')
  })

  it('deja los datos del Product Owner en config', async () => {
    const config = Object.fromEntries((await filas(base, 'select clave, valor from public.config')).map((c) => [c.clave, c.valor]))
    expect(config).toMatchObject({ po_nombre: 'Verónica Rodríguez', po_correo: 'vrodriguez@ises.com.co' })
    expect(config.app_url).toMatch(/^http/)
  })

  it('crea el producto FieldOps y ningún otro catálogo', async () => {
    expect(await escalar(base, 'select nombre from public.producto')).toBe('FieldOps')
    expect(await escalar(base, 'select count(*)::int from public.cliente')).toBe(0)
    expect(await escalar(base, 'select count(*)::int from public.item')).toBe(0)
  })

  it('crea una única fila de smtp_config en modo simulación', async () => {
    const config = await unaFila(base, 'select * from public.smtp_config')
    expect(config).toMatchObject({ host: 'smtp.office365.com', puerto: 587, seguridad: 'starttls', dry_run: true, password: '' })
    expect(await escalar(base, 'select count(*)::int from public.smtp_config')).toBe(1)
  })

  it('no registra notificaciones ni auditoría de negocio al arrancar', async () => {
    expect(await escalar(base, 'select count(*)::int from public.notificacion_log')).toBe(0)
    expect(await escalar(base, 'select count(*)::int from public.alerta_programada')).toBe(0)
  })
})
