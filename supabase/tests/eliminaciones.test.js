import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  crearBase,
  crearCeremonia,
  escalar,
  filas,
  guardarItem,
  insertarAlerta,
  ITEM_BASE,
  unaFila,
} from './helpers/baseDeDatos.js'

describe('eliminar_item', () => {
  let base

  beforeEach(async () => {
    base = await crearBase()
  })
  afterEach(() => base.close())

  it('hace borrado lógico y lo oculta de v_item', async () => {
    const { id } = await guardarItem(base, ITEM_BASE)
    await base.query('select public.eliminar_item($1)', [id])
    expect(await escalar(base, 'select count(*)::int from public.v_item')).toBe(0)
    const fila = await unaFila(base, 'select eliminado_en from public.item where id = $1', [id])
    expect(fila.eliminado_en).not.toBeNull()
  })

  it('resuelve el bloqueante abierto', async () => {
    const { id } = await guardarItem(base, { ...ITEM_BASE, bloqueado: true, motivo_bloqueo: 'Falta API' })
    await base.query('select public.eliminar_item($1)', [id])
    expect(await escalar(base, 'select count(*)::int from public.v_bloqueante_abierto')).toBe(0)
  })

  it('cancela las alertas pendientes del ítem y devuelve cuántas', async () => {
    const { id } = await guardarItem(base, ITEM_BASE)
    await insertarAlerta(base, { entidadId: id })
    await insertarAlerta(base, { entidadId: id, regla: 'REPROGRAMACION' })
    await insertarAlerta(base, { entidadId: id, estado: 'Enviada' })
    const canceladas = await escalar(base, 'select public.eliminar_item($1)', [id])
    expect(canceladas).toBe(2)
    expect(await escalar(base, `select count(*)::int from public.alerta_programada where estado = 'Pendiente'`)).toBe(0)
    expect(await escalar(base, `select count(*)::int from public.alerta_programada where estado = 'Enviada'`)).toBe(1)
  })

  it('no toca las alertas de otros ítems', async () => {
    const primero = await guardarItem(base, ITEM_BASE)
    const segundo = await guardarItem(base, { ...ITEM_BASE, funcionalidad: 'Otra' })
    await insertarAlerta(base, { entidadId: segundo.id })
    await base.query('select public.eliminar_item($1)', [primero.id])
    expect(await escalar(base, `select count(*)::int from public.alerta_programada where estado = 'Pendiente'`)).toBe(1)
  })

  it('falla si el ítem no existe o ya fue eliminado', async () => {
    const { id } = await guardarItem(base, ITEM_BASE)
    await base.query('select public.eliminar_item($1)', [id])
    await expect(base.query('select public.eliminar_item($1)', [id])).rejects.toThrow('no existe')
  })

  it('impide editar un ítem eliminado', async () => {
    const { id } = await guardarItem(base, ITEM_BASE)
    await base.query('select public.eliminar_item($1)', [id])
    await expect(guardarItem(base, { alcance: 'APK' }, { id })).rejects.toThrow('no existe')
  })

  it('conserva la bitácora del ítem eliminado', async () => {
    const { id } = await guardarItem(base, ITEM_BASE, { nota: 'Histórico' })
    await base.query('select public.eliminar_item($1)', [id])
    expect(await escalar(base, 'select count(*)::int from public.nota where item_id = $1', [id])).toBe(1)
  })
})

describe('cancelar_alertas', () => {
  let base

  beforeEach(async () => {
    base = await crearBase()
  })
  afterEach(() => base.close())

  it('cancela todas las pendientes de la entidad', async () => {
    await insertarAlerta(base, { entidadId: 1 })
    await insertarAlerta(base, { entidadId: 1, regla: 'REPROGRAMACION' })
    const canceladas = await escalar(base, `select public.cancelar_alertas('item', 1)`)
    expect(canceladas).toBe(2)
  })

  it('filtra por reglas cuando se indican', async () => {
    await insertarAlerta(base, { entidadId: 1, regla: 'BLOQUEO_ESCALAR' })
    await insertarAlerta(base, { entidadId: 1, regla: 'REPROGRAMACION' })
    const canceladas = await escalar(base, `select public.cancelar_alertas('item', 1, array['BLOQUEO_ESCALAR'])`)
    expect(canceladas).toBe(1)
    const pendiente = await unaFila(base, `select regla_codigo from public.alerta_programada where estado = 'Pendiente'`)
    expect(pendiente.regla_codigo).toBe('REPROGRAMACION')
  })

  it('no cancela alertas de otra entidad ni de otro id', async () => {
    await insertarAlerta(base, { entidad: 'ceremonia', entidadId: 1 })
    await insertarAlerta(base, { entidad: 'item', entidadId: 2 })
    expect(await escalar(base, `select public.cancelar_alertas('item', 1)`)).toBe(0)
  })

  it('ignora las alertas que ya no están pendientes', async () => {
    await insertarAlerta(base, { entidadId: 1, estado: 'Fallida' })
    await insertarAlerta(base, { entidadId: 1, estado: 'Enviada' })
    expect(await escalar(base, `select public.cancelar_alertas('item', 1)`)).toBe(0)
    const estados = (await filas(base, 'select estado from public.alerta_programada order by id')).map((f) => f.estado)
    expect(estados).toEqual(['Fallida', 'Enviada'])
  })
})

describe('eliminar_ceremonia', () => {
  let base

  beforeEach(async () => {
    base = await crearBase()
  })
  afterEach(() => base.close())

  it('borra la ceremonia y cancela sus recordatorios pendientes', async () => {
    const id = await crearCeremonia(base)
    await insertarAlerta(base, { entidad: 'ceremonia', entidadId: id, regla: 'CEREMONIA' })
    const canceladas = await escalar(base, 'select public.eliminar_ceremonia($1)', [id])
    expect(canceladas).toBe(1)
    expect(await escalar(base, 'select count(*)::int from public.ceremonia')).toBe(0)
    expect(await escalar(base, 'select estado from public.alerta_programada')).toBe('Cancelada')
  })

  it('desvincula los acuerdos en lugar de borrarlos', async () => {
    const id = await crearCeremonia(base)
    await base.query(`insert into public.acuerdo (ceremonia_id, descripcion) values ($1, 'Enviar actas')`, [id])
    await base.query('select public.eliminar_ceremonia($1)', [id])
    const acuerdo = await unaFila(base, 'select ceremonia_id from public.acuerdo')
    expect(acuerdo.ceremonia_id).toBeNull()
  })
})
