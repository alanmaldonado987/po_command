import { describe, expect, it } from 'vitest'
import { responder } from './responder'

const AHORA = new Date('2026-11-06T12:00:00Z').getTime()

const item = (extra) => ({
  id: 1,
  codigo: 'BL-001',
  cliente_id: 1,
  cliente: 'ACUACAR',
  actividad: 'SCR',
  modulo: 'Órdenes',
  titulo: 'Órdenes · completo',
  alcance: 'Web',
  estado: 'En curso',
  responsable_id: 1,
  responsable: 'Dairo Pérez',
  fecha_compromiso: '2026-11-01',
  atraso_dias: 5,
  bloqueado: false,
  motivo_bloqueo: '',
  ...extra,
})

const datos = (extra = {}) => ({
  hoy: '2026-11-06',
  ahora: AHORA,
  po: { nombre: 'Verónica' },
  items: [item(), item({ id: 2, codigo: 'BL-002', atraso_dias: 0, fecha_compromiso: '2026-11-08', bloqueado: true, motivo_bloqueo: 'Falta API' })],
  bloqueantes: [
    { id: 9, item_id: 2, codigo: 'BL-002', titulo: 'Torre', cliente: 'ACUACAR', cliente_id: 1, motivo: 'Falta API', abierto_en: '2026-11-04T12:00:00Z' },
  ],
  personas: [
    { id: 1, nombre: 'Dairo Pérez', rol: 'Developer', tipo: 'equipo', activo: true, correo: 'd@ises.com.co' },
    { id: 2, nombre: 'Luisa Gómez', rol: 'QA', tipo: 'equipo', activo: true, correo: '' },
  ],
  ceremonias: [],
  acuerdos: [],
  notas: [{ id: 1, item_id: 1, tipo: 'Reprogramación', fecha: '2026-11-03', texto: 'Cambio de fechas · fin planificado: 01/10/2026 → 01/11/2026' }],
  clientes: [{ id: 1, nombre: 'ACUACAR' }],
  resolverDestinatarios: async () => [{ nombre: 'Ana', correo: 'ana@x.co', rol: 'Stakeholder' }],
  ...extra,
})

describe('responder', () => {
  it('lista los riesgos y propone escalar bloqueos de más de 24 h', async () => {
    const { texto, acciones } = await responder('¿Qué está en riesgo?', datos())
    expect(texto).toContain('BL-002 bloqueado hace 48 h')
    expect(texto).toContain('1 ítem(s) pasaron su fecha fin planificada')
    expect(acciones.map((a) => a.tipo)).toEqual(['escalar', 'recordar'])
  })

  it('agrupa los atrasados por cliente y ofrece recordatorio', async () => {
    const { texto, acciones } = await responder('¿Qué está atrasado?', datos())
    expect(texto).toContain('**ACUACAR**')
    expect(texto).toContain('**5 días**')
    expect(acciones[0]).toMatchObject({ tipo: 'recordar', ids: [1] })
  })

  it('redacta el escalamiento del ítem nombrado con sus destinatarios', async () => {
    const { texto, acciones } = await responder('escala BL-002', datos())
    expect(texto).toContain('Ana <ana@x.co>')
    expect(texto).toContain('bloqueado 48 h')
    expect(acciones[0]).toMatchObject({ tipo: 'escalar', id: 9 })
  })

  it('informa el estado de un ítem y de un cliente', async () => {
    const unItem = await responder('¿cómo va BL-1?', datos())
    expect(unItem.texto).toContain('**BL-001 Órdenes · completo**')
    const cliente = await responder('¿Cómo va acuacar?', datos())
    expect(cliente.texto).toContain('0 de 2 ítems terminados (0%)')
    expect(cliente.acciones[0]).toMatchObject({ tipo: 'escalar' })
  })

  it('reporta reprogramaciones, carga y personas', async () => {
    expect((await responder('¿Qué se reprogramó esta semana?', datos())).texto).toContain('1 reprogramación(es)')
    const carga = await responder('¿Cómo está la carga del equipo?', datos())
    expect(carga.texto).toContain('**Dairo Pérez**: 2 abiertos')
    expect(carga.texto).toContain('Sin ítems abiertos: Luisa Gómez')
    expect((await responder('qué tiene Dairo', datos())).texto).toContain('2 ítem(s) abiertos')
  })

  it('prepara el resumen semanal con la acción de envío', async () => {
    const { texto, acciones } = await responder('resumen semanal para stakeholders', datos())
    expect(texto).toContain('**Avance por cliente:**')
    expect(acciones[0].etiqueta).toBe('Enviar el resumen ahora (1 destinatario/s)')
  })

  it('responde con la ayuda cuando no entiende', async () => {
    const { texto } = await responder('hola mundo', datos())
    expect(texto).toContain('Puedo ayudarte con')
  })
})
