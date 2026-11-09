import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearBase, escalar, fechaRelativa, guardarItem, ITEM_BASE, unaFila } from './helpers/baseDeDatos.js'

describe('v_item', () => {
  let base

  const crear = (datos) => guardarItem(base, { ...ITEM_BASE, ...datos })
  const vista = (id) => unaFila(base, 'select * from public.v_item where id = $1', [id])

  beforeEach(async () => {
    base = await crearBase()
  })
  afterEach(() => base.close())

  describe('atraso_dias', () => {
    it('es 0 cuando no hay fecha comprometida', async () => {
      const { id } = await crear({ estado: 'En curso' })
      expect(await vista(id)).toMatchObject({ atraso_dias: 0, atrasado: false, fecha_compromiso: null })
    })

    it('cuenta los días desde la fecha fin para un ítem En curso vencido', async () => {
      const { id } = await crear({ estado: 'En curso', plan_fin: await fechaRelativa(base, -7) })
      expect(await vista(id)).toMatchObject({ atraso_dias: 7, atrasado: true })
    })

    it('es 0 si la fecha fin es hoy o futura', async () => {
      const hoy = await crear({ estado: 'En curso', plan_fin: await fechaRelativa(base, 0) })
      const futuro = await crear({ funcionalidad: 'Otra', estado: 'En curso', plan_fin: await fechaRelativa(base, 5) })
      expect(await vista(hoy.id)).toMatchObject({ atraso_dias: 0, atrasado: false })
      expect(await vista(futuro.id)).toMatchObject({ atraso_dias: 0, atrasado: false })
    })

    it('usa el fin de pruebas como fecha comprometida cuando existe', async () => {
      const { id } = await crear({
        estado: 'En curso',
        plan_fin: await fechaRelativa(base, -20),
        plan_pruebas_fin: await fechaRelativa(base, -3),
      })
      expect(await vista(id)).toMatchObject({ atraso_dias: 3 })
    })

    it('es 0 para un ítem terminado a tiempo', async () => {
      const { id } = await crear({ estado: 'Terminado', plan_fin: '2026-03-10', real_fin: '2026-03-08' })
      expect(await vista(id)).toMatchObject({ atraso_dias: 0, atrasado: false })
    })

    it('mide la entrega tardía de un ítem terminado sin marcarlo como atrasado', async () => {
      const { id } = await crear({ estado: 'Terminado', plan_fin: '2026-03-10', real_fin: '2026-03-15' })
      expect(await vista(id)).toMatchObject({ atraso_dias: 5, atrasado: false })
    })

    it('es 0 para un ítem terminado sin fecha de entrega', async () => {
      const { id } = await crear({ estado: 'Terminado', plan_fin: '2026-03-10' })
      expect(await vista(id)).toMatchObject({ atraso_dias: 0 })
    })

    it('es 0 para un ítem suspendido aunque esté vencido', async () => {
      const { id } = await crear({ estado: 'Suspendido', plan_fin: await fechaRelativa(base, -30) })
      expect(await vista(id)).toMatchObject({ atraso_dias: 0, atrasado: false })
    })

    it('marca atrasado el ítem Terminado en etapa de pruebas vencido', async () => {
      const { id } = await crear({ estado: 'Terminado, en etapa de pruebas', plan_pruebas_fin: await fechaRelativa(base, -2) })
      expect(await vista(id)).toMatchObject({ atraso_dias: 2, atrasado: true })
    })
  })

  describe('campos derivados', () => {
    it('arma el título «Módulo · completo» para la funcionalidad Completo', async () => {
      const { id } = await crear({ funcionalidad: 'Completo' })
      expect(await escalar(base, 'select titulo from public.v_item where id = $1', [id])).toBe('Torre de Control · completo')
    })

    it('reconoce Completo sin importar las mayúsculas', async () => {
      const { id } = await crear({ funcionalidad: 'COMPLETO' })
      expect(await escalar(base, 'select titulo from public.v_item where id = $1', [id])).toBe('Torre de Control · completo')
    })

    it('usa la funcionalidad como título en los demás casos', async () => {
      const { id } = await crear({ funcionalidad: 'Mapa de rutas' })
      expect(await escalar(base, 'select titulo from public.v_item where id = $1', [id])).toBe('Mapa de rutas')
    })

    it('expone fecha_compromiso y fecha_entrega con prioridad a pruebas', async () => {
      const { id } = await crear({
        plan_fin: '2026-01-10',
        plan_pruebas_fin: '2026-01-20',
        real_fin: '2026-01-12',
        real_pruebas_fin: '2026-01-22',
      })
      const fila = await unaFila(base, `select to_char(fecha_compromiso, 'YYYY-MM-DD') as c, to_char(fecha_entrega, 'YYYY-MM-DD') as e from public.v_item where id = $1`, [id])
      expect(fila).toEqual({ c: '2026-01-20', e: '2026-01-22' })
    })

    it('trae el nombre y correo del responsable', async () => {
      const responsable = await escalar(base, `insert into public.persona (nombre, correo, tipo) values ('Luis', 'luis@ises.com.co', 'equipo') returning id::int`)
      const { id } = await crear({ responsable_id: responsable })
      expect(await vista(id)).toMatchObject({ responsable: 'Luis', responsable_correo: 'luis@ises.com.co' })
    })

    it('excluye los ítems eliminados', async () => {
      const { id } = await crear({})
      await base.query('select public.eliminar_item($1)', [id])
      expect(await escalar(base, 'select count(*)::int from public.v_item')).toBe(0)
    })
  })
})

describe('v_bloqueante_abierto', () => {
  let base

  beforeEach(async () => {
    base = await crearBase()
  })
  afterEach(() => base.close())

  it('lista solo los bloqueantes sin resolver con los datos del ítem', async () => {
    const abierto = await guardarItem(base, { ...ITEM_BASE, bloqueado: true, motivo_bloqueo: 'Falta API' })
    const resuelto = await guardarItem(base, { ...ITEM_BASE, funcionalidad: 'Otra', bloqueado: true, motivo_bloqueo: 'Otro' })
    await guardarItem(base, { bloqueado: false }, { id: resuelto.id })
    const fila = await unaFila(base, 'select * from public.v_bloqueante_abierto')
    expect(fila).toMatchObject({
      item_id: abierto.id,
      motivo: 'Falta API',
      codigo: abierto.codigo,
      titulo: 'Mapa de rutas',
      cliente: 'AIR-E',
      actividad: 'SCR',
      modulo: 'Torre de Control',
      escalado_en: null,
    })
    expect(await escalar(base, 'select count(*)::int from public.v_bloqueante_abierto')).toBe(1)
  })

  it('no muestra bloqueantes de ítems eliminados', async () => {
    const { id } = await guardarItem(base, { ...ITEM_BASE, bloqueado: true, motivo_bloqueo: 'Falta API' })
    await base.query('select public.eliminar_item($1)', [id])
    expect(await escalar(base, 'select count(*)::int from public.v_bloqueante_abierto')).toBe(0)
  })
})

describe('v_persona', () => {
  let base

  beforeEach(async () => {
    base = await crearBase()
  })
  afterEach(() => base.close())

  it('agrega cliente_ids y clientes ordenados por nombre', async () => {
    await base.query(`insert into public.cliente (nombre) values ('AFINIA'), ('AIR-E')`)
    const ids = (await base.query('select id::int from public.cliente order by id')).rows.map((c) => c.id)
    await base.query('select public.guardar_persona($1::jsonb, $2::bigint[])', [JSON.stringify({ nombre: 'Ana', tipo: 'stakeholder' }), ids])
    const fila = await unaFila(base, 'select cliente_ids, clientes from public.v_persona')
    expect(fila.clientes).toBe('AFINIA, AIR-E')
    expect(fila.cliente_ids.map(Number).sort()).toEqual([...ids].sort())
  })

  it('devuelve arreglo vacío y texto vacío si la persona no tiene clientes', async () => {
    await base.query(`insert into public.persona (nombre, tipo) values ('Sin clientes', 'equipo')`)
    expect(await unaFila(base, 'select cliente_ids, clientes from public.v_persona')).toEqual({ cliente_ids: [], clientes: '' })
  })

  it('no duplica personas con varios clientes', async () => {
    await base.query(`insert into public.cliente (nombre) values ('A'), ('B'), ('C')`)
    const ids = (await base.query('select id::int from public.cliente')).rows.map((c) => c.id)
    await base.query('select public.guardar_persona($1::jsonb, $2::bigint[])', [JSON.stringify({ nombre: 'Ana', tipo: 'stakeholder' }), ids])
    expect(await escalar(base, 'select count(*)::int from public.v_persona')).toBe(1)
  })
})

describe('v_ceremonia y v_acuerdo', () => {
  let base

  beforeEach(async () => {
    base = await crearBase()
  })
  afterEach(() => base.close())

  it('v_ceremonia trae el nombre del cliente', async () => {
    const cliente = await escalar(base, `insert into public.cliente (nombre) values ('AIR-E') returning id::int`)
    await base.query(`insert into public.ceremonia (cliente_id, tipo, titulo, fecha_hora) values ($1, 'Demo', 'Demo', now())`, [cliente])
    expect(await escalar(base, 'select cliente from public.v_ceremonia')).toBe('AIR-E')
  })

  it('v_acuerdo trae el responsable y su correo', async () => {
    const persona = await escalar(base, `insert into public.persona (nombre, correo, tipo) values ('Luis', 'luis@ises.com.co', 'equipo') returning id::int`)
    await base.query(`insert into public.acuerdo (descripcion, responsable_id) values ('Enviar acta', $1)`, [persona])
    expect(await unaFila(base, 'select responsable, responsable_correo from public.v_acuerdo')).toEqual({
      responsable: 'Luis',
      responsable_correo: 'luis@ises.com.co',
    })
  })
})
