import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { comoRol, crearBase, escalar } from './helpers/baseDeDatos.js'

const LISTA = 'L-100'
const ms = (desplazamientoSegundos = 60) => String(Date.now() + desplazamientoSegundos * 1000)
const fechaMs = (anio, mes, dia) => String(Date.UTC(anio, mes - 1, dia, 17))

const tarea = (extra = {}) => ({
  id: 'T-1',
  name: 'Mapa de rutas',
  status: { status: 'en desarrollo', type: 'custom' },
  date_updated: ms(60),
  archived: false,
  assignees: [],
  tags: [],
  due_date: null,
  start_date: null,
  url: 'https://app.clickup.com/t/T-1',
  list: { id: LISTA, name: 'AIR-E' },
  ...extra,
})

describe('aplicar_cambio_clickup · resultado para las alertas inmediatas', () => {
  let base

  const aplicar = (datos, evento = 'taskUpdated') =>
    escalar(base, 'select public.aplicar_cambio_clickup($1::jsonb, $2, null)', [JSON.stringify(datos), evento])
  const aplicarForzado = (datos) =>
    escalar(base, `select public.aplicar_cambio_clickup($1::jsonb, 'reconciliar', null, true)`, [JSON.stringify(datos)])

  beforeEach(async () => {
    base = await crearBase()
    await base.query(`insert into public.cliente (nombre) values ('AIR-E')`)
    await base.query(`insert into public.clickup_destino (cliente_id, lista_id, lista_nombre) values (1, $1, 'AIR-E')`, [LISTA])
  })
  afterEach(() => base.close())

  it('al crear devuelve el guardado sin estado previo y con el bloqueo final', async () => {
    const resultado = await aplicar(tarea({ tags: [{ name: 'bloqueado' }] }), 'taskCreated')
    expect(resultado.resultado).toBe('creado')
    expect(resultado.guardado).toMatchObject({ id: resultado.item_id, antes: null, cambios: [], sin_cambios: false, bloqueado: true })
  })

  it('al bloquear desde ClickUp informa que antes no estaba bloqueado y ahora sí', async () => {
    await aplicar(tarea(), 'taskCreated')
    const resultado = await aplicar(tarea({ tags: [{ name: 'bloqueado' }], date_updated: ms(120) }))
    expect(resultado.resultado).toBe('actualizado')
    expect(resultado.guardado.antes).toEqual({ bloqueado: false, motivo_bloqueo: '' })
    expect(resultado.guardado.bloqueado).toBe(true)
    expect(resultado.guardado.id).toBe(resultado.item_id)
  })

  it('al desbloquear desde ClickUp informa el bloqueo anterior y su motivo', async () => {
    await aplicar(tarea({ tags: [{ name: 'bloqueado' }] }), 'taskCreated')
    const resultado = await aplicar(tarea({ tags: [], date_updated: ms(120) }))
    expect(resultado.resultado).toBe('actualizado')
    expect(resultado.guardado.antes).toEqual({ bloqueado: true, motivo_bloqueo: 'Bloqueado desde ClickUp' })
    expect(resultado.guardado.bloqueado).toBe(false)
  })

  it('al cambiar la fecha en ClickUp devuelve cada fecha antes y después', async () => {
    await aplicar(tarea({ due_date: fechaMs(2026, 1, 15) }), 'taskCreated')
    const resultado = await aplicar(tarea({ due_date: fechaMs(2026, 2, 20), date_updated: ms(120) }))
    expect(resultado.guardado.cambios).toEqual([{ campo: 'plan_fin', antes: '2026-01-15', despues: '2026-02-20' }])
    expect(resultado.guardado.bloqueado).toBe(false)
  })

  it('un cambio que no toca fechas ni bloqueo devuelve guardado sin cambios de fecha', async () => {
    await aplicar(tarea(), 'taskCreated')
    const resultado = await aplicar(tarea({ status: { status: 'validación', type: 'custom' }, date_updated: ms(120) }))
    expect(resultado.resultado).toBe('actualizado')
    expect(resultado.guardado.cambios).toEqual([])
    expect(resultado.guardado.antes.bloqueado).toBe(false)
    expect(resultado.guardado.bloqueado).toBe(false)
  })

  it('sin ninguna novedad no devuelve guardado', async () => {
    await aplicar(tarea(), 'taskCreated')
    const resultado = await aplicar(tarea({ date_updated: ms(120) }))
    expect(resultado.resultado).toBe('sin_cambios')
    expect(resultado).not.toHaveProperty('guardado')
  })

  it('los cambios ignorados y los archivados no devuelven guardado', async () => {
    await aplicar(tarea(), 'taskCreated')
    const antiguo = await aplicar(tarea({ tags: [{ name: 'bloqueado' }], date_updated: '1000' }))
    expect(antiguo.resultado).toBe('ignorado')
    expect(antiguo).not.toHaveProperty('guardado')
    const archivado = await aplicar(tarea(), 'taskDeleted')
    expect(archivado.resultado).toBe('archivado')
    expect(archivado).not.toHaveProperty('guardado')
  })

  it('el cambio forzado también devuelve el guardado (la función Edge decide no avisar)', async () => {
    await aplicar(tarea(), 'taskCreated')
    const resultado = await aplicarForzado(tarea({ tags: [{ name: 'bloqueado' }], date_updated: ms(120) }))
    expect(resultado.resultado).toBe('actualizado')
    expect(resultado.guardado.bloqueado).toBe(true)
  })

  it('el eco de un envío de la app (misma marca de tiempo que clickup_sync_en) se ignora y no devuelve guardado', async () => {
    const marca = ms(120)
    await aplicar(tarea(), 'taskCreated')
    await base.query(`update public.item set clickup_sync_en = to_timestamp($1::numeric / 1000.0) where clickup_task_id = 'T-1'`, [marca])
    const eco = await aplicar(tarea({ tags: [{ name: 'bloqueado' }], date_updated: marca }))
    expect(eco.resultado).toBe('ignorado')
    expect(eco).not.toHaveProperty('guardado')
  })

  it('un cambio de la app pendiente de envío hace ignorar el de ClickUp y no devuelve guardado', async () => {
    await aplicar(tarea(), 'taskCreated')
    await base.query(`insert into public.clickup_cola (item_id, accion, estado) select id, 'update', 'Pendiente' from public.item where clickup_task_id = 'T-1'`)
    const resultado = await aplicar(tarea({ tags: [{ name: 'bloqueado' }], date_updated: ms(120) }))
    expect(resultado.resultado).toBe('ignorado')
    expect(resultado).not.toHaveProperty('guardado')
  })

  it('mantiene la firma de cuatro argumentos y la llamada con tres sigue funcionando', async () => {
    const funciones = await base.query(`select pg_get_function_identity_arguments(oid) as firma from pg_proc where proname = 'aplicar_cambio_clickup'`)
    expect(funciones.rows).toHaveLength(1)
    expect((await aplicar(tarea(), 'taskCreated')).resultado).toBe('creado')
  })

  it('solo el service role puede ejecutarla', async () => {
    await comoRol(base, 'authenticated', async () => {
      await expect(base.query(`select public.aplicar_cambio_clickup('{"id":"X"}'::jsonb)`)).rejects.toThrow(/permission denied/i)
    })
    await comoRol(base, 'anon', async () => {
      await expect(base.query(`select public.aplicar_cambio_clickup('{"id":"X"}'::jsonb)`)).rejects.toThrow(/permission denied/i)
    })
  })
})
