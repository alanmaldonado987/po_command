import { describe, expect, it, vi } from 'vitest'
import { crearBloqueante, crearCeremonia, crearItem, crearPersona } from '../../../test/fabricas'
import { responder } from './responder'

const AHORA = new Date('2026-11-06T12:00:00Z').getTime()
const HOY = '2026-11-06'

const datosBase = (extra = {}) => ({
  hoy: HOY,
  ahora: AHORA,
  po: { nombre: 'Verónica' },
  items: [],
  bloqueantes: [],
  personas: [],
  ceremonias: [],
  acuerdos: [],
  notas: [],
  clientes: [{ id: 1, nombre: 'AIR-E' }, { id: 2, nombre: 'ACUACAR' }],
  resolverDestinatarios: vi.fn().mockResolvedValue([]),
  ...extra,
})

const bloqueo = (horas, extra = {}) =>
  crearBloqueante({ abierto_en: new Date(AHORA - horas * 3_600_000).toISOString(), ...extra })

describe('riesgos', () => {
  it('sin nada que reportar lo dice', async () => {
    const { texto, acciones } = await responder('¿Qué está en riesgo?', datosBase())
    expect(texto).toContain('No veo riesgos')
    expect(acciones).toEqual([])
  })

  it('un bloqueo reciente no propone escalar', async () => {
    const b = bloqueo(3, { id: 50, codigo: 'BL-010' })
    const { texto, acciones } = await responder('riesgos', datosBase({ bloqueantes: [b] }))
    expect(texto).toContain('BL-010 bloqueado hace 3 h')
    expect(acciones).toEqual([])
  })

  it('el límite de 24 h es estricto', async () => {
    const { acciones } = await responder('riesgos', datosBase({ bloqueantes: [bloqueo(24)] }))
    expect(acciones).toEqual([])
    const mas = await responder('riesgos', datosBase({ bloqueantes: [bloqueo(25)] }))
    expect(mas.acciones[0].tipo).toBe('escalar')
  })

  it('reporta próximos a vencer, sin responsable y sin fecha', async () => {
    const items = [
      crearItem({ codigo: 'BL-021', fecha_compromiso: '2026-11-09', atraso_dias: 0 }),
      crearItem({ codigo: 'BL-022', responsable_id: null, responsable: null }),
      crearItem({ codigo: 'BL-023', estado: 'En curso', fecha_compromiso: null }),
    ]
    const { texto } = await responder('riesgos', datosBase({ items }))
    expect(texto).toContain('[Medio] 1 ítem(s) vencen en los próximos 7 días')
    expect(texto).toContain('abiertos sin responsable**: BL-022')
    expect(texto).toContain('[Bajo] 2 ítem(s) en curso sin fecha fin planificada')
  })

  it('las acciones nunca superan cuatro', async () => {
    const bloqueantes = Array.from({ length: 6 }, (_, i) => bloqueo(48, { id: 100 + i, codigo: `BL-0${i}` }))
    const items = [crearItem({ atraso_dias: 3, fecha_compromiso: '2026-11-01' })]
    const { acciones } = await responder('riesgos', datosBase({ bloqueantes, items }))
    expect(acciones).toHaveLength(4)
  })
})

describe('atrasados', () => {
  it('sin atrasados informa', async () => {
    const { texto, acciones } = await responder('¿Qué está atrasado?', datosBase({ items: [crearItem()] }))
    expect(texto).toBe('No hay ítems atrasados frente a su fecha fin planificada.')
    expect(acciones).toEqual([])
  })

  it('ordena por cliente y mayor atraso, y excluye cerrados', async () => {
    const items = [
      crearItem({ id: 1, codigo: 'BL-001', cliente: 'AIR-E', atraso_dias: 2, fecha_compromiso: '2026-11-01' }),
      crearItem({ id: 2, codigo: 'BL-002', cliente: 'AIR-E', atraso_dias: 9, fecha_compromiso: '2026-10-20' }),
      crearItem({ id: 3, codigo: 'BL-003', cliente: 'ACUACAR', atraso_dias: 1, fecha_compromiso: '2026-11-05' }),
      crearItem({ id: 4, codigo: 'BL-004', estado: 'Terminado', atraso_dias: 30 }),
    ]
    const { texto, acciones } = await responder('retrasos', datosBase({ items }))
    expect(texto.indexOf('ACUACAR')).toBeLessThan(texto.indexOf('AIR-E'))
    expect(texto.indexOf('BL-002')).toBeLessThan(texto.indexOf('BL-001'))
    expect(texto).not.toContain('BL-004')
    expect(acciones[0].ids).toEqual([3, 2, 1])
  })
})

describe('escalamiento', () => {
  it('sin bloqueos no hay nada que escalar', async () => {
    const { texto } = await responder('redacta el escalamiento', datosBase())
    expect(texto).toBe('No hay bloqueos abiertos para escalar.')
  })

  it('sin destinatarios válidos lo advierte y la acción cuenta cero', async () => {
    const item = crearItem({ id: 7, codigo: 'BL-007' })
    const b = bloqueo(30, { id: 70, item_id: 7, codigo: 'BL-007' })
    const { texto, acciones } = await responder('escalar', datosBase({ items: [item], bloqueantes: [b] }))
    expect(texto).toContain('nadie con correo válido')
    expect(acciones[0].etiqueta).toBe('Enviar este escalamiento (0 destinatario/s)')
  })

  it('elige el bloqueo indicado por código y si no existe usa el primero', async () => {
    const items = [crearItem({ id: 1, codigo: 'BL-001' }), crearItem({ id: 2, codigo: 'BL-002' })]
    const bloqueantes = [bloqueo(30, { id: 10, item_id: 1, codigo: 'BL-001' }), bloqueo(40, { id: 20, item_id: 2, codigo: 'BL-002' })]
    const elegido = await responder('escala BL-2', datosBase({ items, bloqueantes }))
    expect(elegido.acciones[0].id).toBe(20)
    const inexistente = await responder('escala BL-99', datosBase({ items, bloqueantes }))
    expect(inexistente.acciones[0].id).toBe(10)
  })

  it('consulta los destinatarios de la regla de escalamiento con el ítem', async () => {
    const resolverDestinatarios = vi.fn().mockResolvedValue([{ nombre: 'Ana', correo: 'ana@x.co', rol: 'Stakeholder' }])
    const item = crearItem({ id: 4, codigo: 'BL-004', fecha_compromiso: '2026-12-01' })
    const { texto } = await responder('escala', datosBase({ items: [item], bloqueantes: [bloqueo(5, { item_id: 4, codigo: 'BL-004' })], resolverDestinatarios }))
    expect(resolverDestinatarios).toHaveBeenCalledWith({ regla_codigo: 'BLOQUEO_ESCALAR', item_id: 4 })
    expect(texto).toContain('antes de la fecha fin planificada (01/12/2026)')
    expect(texto).toContain('Verónica')
  })
})

describe('resumen', () => {
  it('lista terminados de 7 días, atrasados y sin ceremonias', async () => {
    const items = [
      crearItem({ codigo: 'BL-031', estado: 'Terminado', terminado_en: '2026-11-04' }),
      crearItem({ codigo: 'BL-032', estado: 'Terminado', terminado_en: '2026-10-01' }),
      crearItem({ atraso_dias: 4 }),
    ]
    const { texto } = await responder('resumen semanal', datosBase({ items }))
    expect(texto).toContain('**Terminados en 7 días:** 1: BL-031.')
    expect(texto).toContain('**Atrasados:** 1.')
    expect(texto).toContain('sin ceremonias agendadas')
  })

  it('muestra solo las próximas tres ceremonias futuras', async () => {
    const futuras = [1, 2, 3, 4].map((dias) =>
      crearCeremonia({ titulo: `Demo ${dias}`, fecha_hora: new Date(AHORA + dias * 86_400_000).toISOString() }),
    )
    const pasada = crearCeremonia({ titulo: 'Vieja', fecha_hora: new Date(AHORA - 86_400_000).toISOString() })
    const { texto } = await responder('resumen', datosBase({ ceremonias: [pasada, ...futuras] }))
    expect(texto).toContain('Demo 3')
    expect(texto).not.toContain('Demo 4')
    expect(texto).not.toContain('Vieja')
  })
})

describe('carga del equipo', () => {
  it('sin ítems abiertos lo informa', async () => {
    const { texto } = await responder('carga del equipo', datosBase())
    expect(texto).toBe('No hay ítems abiertos.')
  })

  it('ordena por abiertos y lista a los libres solo si están activos', async () => {
    const items = [
      crearItem({ responsable: 'Ana', responsable_id: 1 }),
      crearItem({ responsable: 'Beto', responsable_id: 2, atraso_dias: 2, atrasado: true }),
      crearItem({ responsable: 'Beto', responsable_id: 2 }),
    ]
    const personas = [
      crearPersona({ nombre: 'Carla', activo: true }),
      crearPersona({ nombre: 'Inactivo', activo: false }),
      crearPersona({ nombre: 'Stake', tipo: 'stakeholder' }),
    ]
    const { texto } = await responder('capacidad del equipo', datosBase({ items, personas }))
    expect(texto.indexOf('Beto')).toBeLessThan(texto.indexOf('Ana'))
    expect(texto).toContain('**1 atrasados**')
    expect(texto).toContain('Sin ítems abiertos: Carla.')
  })
})

describe('vencimientos y reprogramaciones', () => {
  it('nada por vencer', async () => {
    const { texto } = await responder('qué vence esta semana', datosBase())
    expect(texto).toBe('Nada vence en los próximos 7 días.')
  })

  it('marca los vencidos y suma acuerdos pendientes dentro de la ventana', async () => {
    const items = [crearItem({ codigo: 'BL-041', fecha_compromiso: '2026-11-01' })]
    const acuerdos = [
      { id: 1, descripcion: 'Enviar acta', fecha_limite: '2026-11-08', estado: 'Pendiente', responsable: null },
      { id: 2, descripcion: 'Cumplido ya', fecha_limite: '2026-11-08', estado: 'Cumplido', responsable: 'Ana' },
      { id: 3, descripcion: 'Lejano', fecha_limite: '2026-12-31', estado: 'Pendiente', responsable: 'Ana' },
    ]
    const { texto } = await responder('qué vence', datosBase({ items, acuerdos }))
    expect(texto).toContain('**Vencido** · 01/11/2026')
    expect(texto).toContain('Acuerdo: Enviar acta (sin responsable)')
    expect(texto).not.toContain('Cumplido ya')
    expect(texto).not.toContain('Lejano')
  })

  it('reprogramaciones: vacío, fuera de ventana y nota sin ítem', async () => {
    expect((await responder('reprogramaciones', datosBase())).texto).toContain('No hubo cambios de fechas')
    const vieja = [{ id: 1, item_id: 1, tipo: 'Reprogramación', fecha: '2026-10-01', texto: 'x' }]
    expect((await responder('reprogramaciones', datosBase({ notas: vieja }))).texto).toContain('No hubo cambios')
    const huerfana = [{ id: 2, item_id: 999, tipo: 'Reprogramación', fecha: '2026-11-05', texto: 'Cambio de fechas · fin: 1 → 2' }]
    const { texto } = await responder('reprogramaciones', datosBase({ notas: huerfana }))
    expect(texto).toContain('0 reprogramación(es)')
  })

  it('quita el prefijo de la nota y formatea la fecha', async () => {
    const item = crearItem({ id: 5, codigo: 'BL-005', cliente: 'AIR-E', titulo: 'Mapa' })
    const notas = [{ id: 3, item_id: 5, tipo: 'Reprogramación', fecha: '2026-11-05', texto: 'Cambio de fechas · fin planificado: 01/11 → 10/11' }]
    const { texto } = await responder('qué se reprogramó', datosBase({ items: [item], notas }))
    expect(texto).toContain('05/11/2026 · **BL-005** AIR-E · Mapa: fin planificado: 01/11 → 10/11')
  })
})

describe('un ítem', () => {
  it('rellena el código con ceros y avisa si no existe', async () => {
    const item = crearItem({ id: 1, codigo: 'BL-007', titulo: 'Mapa' })
    expect((await responder('¿cómo va BL-7?', datosBase({ items: [item] }))).texto).toContain('**BL-007 Mapa**')
    expect((await responder('¿cómo va bl 8?', datosBase({ items: [item] }))).texto).toBe('No encontré el ítem BL-008.')
  })

  it('muestra bloqueo, atraso, las tres últimas notas y ofrece escalar', async () => {
    const item = crearItem({ id: 9, codigo: 'BL-009', bloqueado: true, motivo_bloqueo: 'Sin API', atraso_dias: 6 })
    const notas = [1, 2, 3, 4].map((n) => ({ id: n, item_id: 9, tipo: 'Seguimiento', fecha: `2026-11-0${n}`, texto: `nota ${n}` }))
    const b = bloqueo(10, { id: 90, item_id: 9, codigo: 'BL-009' })
    const { texto, acciones } = await responder('estado de BL-9', datosBase({ items: [item], notas, bloqueantes: [b] }))
    expect(texto).toContain('**Bloqueado:** Sin API')
    expect(texto).toContain('**6 días de atraso**')
    expect(texto).toContain('nota 4')
    expect(texto).not.toContain('nota 1')
    expect(acciones[0]).toMatchObject({ tipo: 'escalar', id: 90 })
  })
})

describe('un cliente', () => {
  it('cliente sin ítems', async () => {
    const { texto } = await responder('cómo va ACUACAR', datosBase({ items: [crearItem({ cliente_id: 1 })] }))
    expect(texto).toBe('ACUACAR no tiene ítems en el backlog.')
  })

  it('reconoce el nombre sin guion y calcula el porcentaje', async () => {
    const items = [
      crearItem({ cliente_id: 1, estado: 'Terminado' }),
      crearItem({ cliente_id: 1 }),
      crearItem({ cliente_id: 1 }),
    ]
    const { texto } = await responder('avance de aire', datosBase({ items }))
    expect(texto).toContain('1 de 3 ítems terminados (33%)')
    expect((await responder('Cómo va AIRE?', datosBase({ items }))).texto).toContain('AIR-E')
  })

  it('lista los cinco más atrasados y los bloqueos con acciones (máximo 2)', async () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      crearItem({ id: 200 + i, codigo: `BL-2${i}`, cliente_id: 1, atraso_dias: i + 1, fecha_compromiso: '2026-10-01' }),
    )
    const bloqueantes = [1, 2, 3].map((n) => bloqueo(5, { id: 300 + n, cliente_id: 1, codigo: `BL-9${n}` }))
    const { texto, acciones } = await responder('cómo va AIR-E', datosBase({ items, bloqueantes }))
    expect(texto.match(/días\b/g).length).toBeGreaterThanOrEqual(5)
    expect(texto).not.toContain('BL-20 ')
    expect(acciones).toHaveLength(2)
  })
})

describe('personas y navegación general', () => {
  it('ignora fragmentos de nombre muy cortos', async () => {
    const personas = [crearPersona({ nombre: 'Ana Li' })]
    const { texto } = await responder('qué tiene Ana', datosBase({ personas }))
    expect(texto).toContain('Puedo ayudarte con')
  })

  it('persona sin ítems abiertos y sin correo', async () => {
    const personas = [crearPersona({ id: 77, nombre: 'Dairo Pérez', correo: '', rol: '' , tipo: 'equipo' })]
    const { texto } = await responder('qué tiene Dairo', datosBase({ personas }))
    expect(texto).toContain('sin correo')
    expect(texto).toContain('No tiene ítems abiertos.')
  })

  it('resuelve preguntas con tildes y mayúsculas', async () => {
    expect((await responder('¿QUÉ ESTÁ ATRASADO?', datosBase())).texto).toContain('No hay ítems atrasados')
    expect((await responder('RESUMEN', datosBase())).acciones[0].tipo).toBe('resumen')
  })

  it('la ayuda se muestra con entradas vacías o sin sentido', async () => {
    expect((await responder('', datosBase())).texto).toContain('No estoy seguro')
    expect((await responder('???', datosBase())).texto).toContain('Puedo ayudarte con')
  })
})
