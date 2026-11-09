import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearBase, crearCeremonia, escalar, filas, guardarItem, ITEM_BASE, unaFila } from './helpers/baseDeDatos.js'

const auditoria = (base, entidad) =>
  filas(base, 'select accion, detalle, entidad_id::int as entidad_id from public.auditoria where entidad = $1 order by id', [entidad])

describe('auditoría por triggers', () => {
  let base

  beforeEach(async () => {
    base = await crearBase()
  })
  afterEach(() => base.close())

  it('registra la creación de un ítem con su código y funcionalidad', async () => {
    const { id } = await guardarItem(base, ITEM_BASE)
    const registros = await auditoria(base, 'item')
    expect(registros).toEqual([{ accion: 'crear', detalle: 'BL-001 Mapa de rutas', entidad_id: id }])
  })

  it('registra la edición de un ítem', async () => {
    const { id } = await guardarItem(base, ITEM_BASE)
    await guardarItem(base, { alcance: 'APK' }, { id })
    expect((await auditoria(base, 'item')).map((r) => r.accion)).toEqual(['crear', 'editar'])
  })

  it('registra el borrado lógico como eliminar', async () => {
    const { id } = await guardarItem(base, ITEM_BASE)
    await base.query('select public.eliminar_item($1)', [id])
    const ultimo = (await auditoria(base, 'item')).at(-1)
    expect(ultimo).toMatchObject({ accion: 'eliminar', detalle: 'BL-001 Mapa de rutas' })
  })

  it('registra altas de catálogos creados al guardar un ítem', async () => {
    await guardarItem(base, { ...ITEM_BASE, producto: 'FieldOps' })
    expect((await auditoria(base, 'cliente'))[0]).toMatchObject({ accion: 'crear', detalle: 'AIR-E' })
    expect((await auditoria(base, 'actividad'))[0]).toMatchObject({ accion: 'crear', detalle: 'SCR' })
    expect((await auditoria(base, 'modulo'))[0]).toMatchObject({ accion: 'crear', detalle: 'Torre de Control' })
  })

  it('registra la edición y el borrado de un cliente', async () => {
    const id = await escalar(base, `insert into public.cliente (nombre) values ('AIR-E') returning id::int`)
    await base.query(`update public.cliente set nombre = 'AIR-E SAS' where id = $1`, [id])
    await base.query('delete from public.cliente where id = $1', [id])
    const registros = await auditoria(base, 'cliente')
    expect(registros.map((r) => r.accion)).toEqual(['crear', 'editar', 'eliminar'])
    expect(registros.at(-1).detalle).toBe('AIR-E SAS')
  })

  it('registra las personas con su nombre', async () => {
    await base.query(`insert into public.persona (nombre, tipo) values ('Ana Gómez', 'equipo')`)
    expect((await auditoria(base, 'persona'))[0]).toMatchObject({ accion: 'crear', detalle: 'Ana Gómez' })
  })

  it('registra las ceremonias con su título', async () => {
    const id = await crearCeremonia(base, { titulo: 'Demo de enero' })
    await base.query('select public.eliminar_ceremonia($1)', [id])
    const registros = await auditoria(base, 'ceremonia')
    expect(registros.map((r) => [r.accion, r.detalle])).toEqual([
      ['crear', 'Demo de enero'],
      ['eliminar', 'Demo de enero'],
    ])
  })

  it('no audita notas ni bloqueantes', async () => {
    await guardarItem(base, { ...ITEM_BASE, bloqueado: true, motivo_bloqueo: 'Falta API' }, { nota: 'x' })
    expect(await auditoria(base, 'nota')).toEqual([])
    expect(await auditoria(base, 'bloqueante')).toEqual([])
  })

  it('registrar_auditoria guarda un registro manual', async () => {
    await base.query(`select public.registrar_auditoria('correo', null, 'activar', 'Envío real')`)
    expect(await auditoria(base, 'correo')).toEqual([{ accion: 'activar', detalle: 'Envío real', entidad_id: null }])
  })
})

describe('tocar_actualizado', () => {
  let base

  beforeEach(async () => {
    base = await crearBase()
  })
  afterEach(() => base.close())

  it('refresca actualizado_en del ítem al editarlo sin tocar creado_en', async () => {
    const { id } = await guardarItem(base, ITEM_BASE)
    await base.query(`update public.item set creado_en = now() - interval '2 days', actualizado_en = now() - interval '2 days' where id = $1`, [id])
    await guardarItem(base, { alcance: 'APK' }, { id })
    const fila = await unaFila(base, `select actualizado_en > now() - interval '1 minute' as reciente, creado_en < now() - interval '1 day' as intacto from public.item where id = $1`, [id])
    expect(fila).toEqual({ reciente: true, intacto: true })
  })

  it('refresca actualizado_en de personas y productos', async () => {
    const persona = await escalar(base, `insert into public.persona (nombre, tipo) values ('Ana', 'equipo') returning id::int`)
    await base.query(`update public.persona set actualizado_en = now() - interval '2 days' where id = $1`, [persona])
    await base.query(`update public.persona set rol = 'Dev' where id = $1`, [persona])
    expect(await escalar(base, `select actualizado_en > now() - interval '1 minute' from public.persona where id = $1`, [persona])).toBe(true)

    await base.query(`update public.producto set actualizado_en = now() - interval '2 days'`)
    await base.query(`update public.producto set descripcion = 'Nueva'`)
    expect(await escalar(base, `select actualizado_en > now() - interval '1 minute' from public.producto`)).toBe(true)
  })
})
