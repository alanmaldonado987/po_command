import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { comoRol, crearBase, escalar, filas, guardarItem, ITEM_BASE, unaFila } from './helpers/baseDeDatos.js'

const LISTA = 'L-100'

const tarea = (extra = {}) => ({
  id: 'T-1',
  name: 'Mapa de rutas',
  status: { status: 'en desarrollo', type: 'custom' },
  date_updated: String(Date.now() + 60_000),
  archived: false,
  assignees: [],
  tags: [],
  due_date: null,
  start_date: null,
  url: 'https://app.clickup.com/t/T-1',
  list: { id: LISTA, name: 'AIR-E' },
  ...extra,
})

describe('prioridad de los ítems', () => {
  let base

  const prioridadDe = (id) => escalar(base, 'select prioridad from public.item where id = $1', [id])
  const cola = () => filas(base, 'select item_id::int, accion, estado from public.clickup_cola order by id')
  const aplicar = (datos, evento = 'taskUpdated') =>
    escalar(base, 'select public.aplicar_cambio_clickup($1::jsonb, $2, null)', [JSON.stringify(datos), evento])
  const crearVinculado = async (datos = {}) => {
    const { id } = await guardarItem(base, { ...ITEM_BASE, ...datos })
    await base.query(
      `update public.item set clickup_task_id = 'T-1', clickup_url = 'https://x', clickup_sync_en = now() - interval '1 hour' where id = $1`,
      [id],
    )
    return id
  }

  beforeEach(async () => {
    base = await crearBase()
    await base.query(`insert into public.cliente (nombre) values ('AIR-E')`)
    await base.query(`insert into public.clickup_destino (cliente_id, lista_id, lista_nombre) values (1, $1, 'AIR-E')`, [LISTA])
  })
  afterEach(() => base.close())

  describe('columna y guardado', () => {
    it('un ítem nuevo no tiene prioridad por defecto', async () => {
      const { id } = await guardarItem(base, ITEM_BASE)
      expect(await prioridadDe(id)).toBeNull()
    })

    it.each(['Urgente', 'Alta', 'Normal', 'Baja'])('guarda la prioridad %s', async (prioridad) => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, prioridad })
      expect(await prioridadDe(id)).toBe(prioridad)
    })

    it('la restricción de la tabla rechaza valores fuera de la lista', async () => {
      const { id } = await guardarItem(base, ITEM_BASE)
      await expect(base.query(`update public.item set prioridad = 'Crítica' where id = $1`, [id])).rejects.toThrow()
    })

    it('guardar_item rechaza una prioridad inválida con un mensaje claro', async () => {
      await expect(guardarItem(base, { ...ITEM_BASE, prioridad: 'Crítica' })).rejects.toThrow(
        'La prioridad debe ser Urgente, Alta, Normal o Baja',
      )
    })

    it('una prioridad vacía o con espacios queda como sin prioridad', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, prioridad: '  ' })
      expect(await prioridadDe(id)).toBeNull()
      const otro = await guardarItem(base, { ...ITEM_BASE, funcionalidad: 'Otro', prioridad: '' })
      expect(await prioridadDe(otro.id)).toBeNull()
    })

    it('editar sin enviar la clave conserva la prioridad y enviarla como null la quita', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, prioridad: 'Alta' })
      await guardarItem(base, { estado: 'En curso' }, { id })
      expect(await prioridadDe(id)).toBe('Alta')
      await guardarItem(base, { prioridad: 'Baja' }, { id })
      expect(await prioridadDe(id)).toBe('Baja')
      await guardarItem(base, { prioridad: null }, { id })
      expect(await prioridadDe(id)).toBeNull()
    })

    it('un cambio de prioridad cuenta como edición y queda en la auditoría', async () => {
      const { id } = await guardarItem(base, ITEM_BASE)
      const resultado = await guardarItem(base, { prioridad: 'Urgente' }, { id })
      expect(resultado.sin_cambios).toBe(false)
      const acciones = await filas(
        base,
        `select accion from public.auditoria where entidad = 'item' and entidad_id = $1 order by id`,
        [id],
      )
      expect(acciones.map((a) => a.accion)).toEqual(['crear', 'editar'])
    })
  })

  describe('vistas y permisos', () => {
    it('v_item expone la prioridad', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, prioridad: 'Normal' })
      expect(await escalar(base, 'select prioridad from public.v_item where id = $1', [id])).toBe('Normal')
    })

    it('v_bloqueante_abierto sigue funcionando tras recrear las vistas', async () => {
      await guardarItem(base, { ...ITEM_BASE, prioridad: 'Alta', bloqueado: true, motivo_bloqueo: 'Falta acceso' })
      expect(await escalar(base, 'select count(*)::int from public.v_bloqueante_abierto')).toBe(1)
    })

    it('un usuario autenticado lee y guarda la prioridad, y anon no ve ningún ítem', async () => {
      const { id } = await comoRol(base, 'authenticated', () => guardarItem(base, { ...ITEM_BASE, prioridad: 'Alta' }))
      expect(await comoRol(base, 'authenticated', () => escalar(base, 'select prioridad from public.v_item where id = $1', [id]))).toBe('Alta')
      expect(await comoRol(base, 'anon', () => escalar(base, 'select count(*)::int from public.v_item'))).toBe(0)
    })

    it('la función de traducción solo la ejecuta el servicio, no anon ni los usuarios', async () => {
      for (const rol of ['anon', 'authenticated']) {
        await expect(
          comoRol(base, rol, () => escalar(base, `select public._prioridad_desde_clickup('{"id":"1"}'::jsonb)`)),
        ).rejects.toThrow()
      }
      expect(
        await comoRol(base, 'service_role', () => escalar(base, `select public._prioridad_desde_clickup('{"id":"1"}'::jsonb)`)),
      ).toBe('Urgente')
    })
  })

  describe('traducción desde ClickUp', () => {
    it.each([
      [{ id: '1', priority: 'urgent' }, 'Urgente'],
      [{ id: '2', priority: 'high' }, 'Alta'],
      [{ id: '3', priority: 'normal' }, 'Normal'],
      [{ id: '4', priority: 'low' }, 'Baja'],
      [{ id: '1' }, 'Urgente'],
      [{ priority: 'LOW' }, 'Baja'],
      [{ id: '9', priority: 'critica' }, null],
      [{}, null],
    ])('%j → %s', async (prioridad, esperado) => {
      expect(await escalar(base, 'select public._prioridad_desde_clickup($1::jsonb)', [JSON.stringify(prioridad)])).toBe(esperado)
    })
  })

  describe('cola de salida', () => {
    const habilitar = () => base.query('update public.clickup_config set habilitado = true')

    it('encola un update al cambiar solo la prioridad de un ítem vinculado', async () => {
      const id = await crearVinculado()
      await habilitar()
      await guardarItem(base, { prioridad: 'Alta' }, { id })
      expect(await cola()).toEqual([{ item_id: id, accion: 'update', estado: 'Pendiente' }])
    })

    it('no encola nada si la prioridad guardada es la misma', async () => {
      const id = await crearVinculado({ prioridad: 'Alta' })
      await habilitar()
      await guardarItem(base, { prioridad: 'Alta' }, { id })
      expect(await cola()).toEqual([])
    })

    it('quitar la prioridad también encola un update', async () => {
      const id = await crearVinculado({ prioridad: 'Alta' })
      await habilitar()
      await guardarItem(base, { prioridad: null }, { id })
      expect(await cola()).toEqual([{ item_id: id, accion: 'update', estado: 'Pendiente' }])
    })
  })

  describe('cambios que llegan desde ClickUp', () => {
    const habilitar = () => base.query('update public.clickup_config set habilitado = true')

    it('una tarea nueva con prioridad crea el ítem con esa prioridad', async () => {
      await aplicar(tarea({ priority: { id: '2', priority: 'high' } }), 'taskCreated')
      expect(await escalar(base, `select prioridad from public.item where clickup_task_id = 'T-1'`)).toBe('Alta')
    })

    it('una tarea nueva sin prioridad deja el ítem sin prioridad', async () => {
      await aplicar(tarea({ priority: null }), 'taskCreated')
      expect(await escalar(base, `select prioridad from public.item where clickup_task_id = 'T-1'`)).toBeNull()
    })

    it('un cambio de prioridad en ClickUp actualiza el ítem', async () => {
      const id = await crearVinculado({ prioridad: 'Baja' })
      await aplicar(tarea({ priority: { id: '1', priority: 'urgent' } }), 'taskPriorityUpdated')
      expect(await prioridadDe(id)).toBe('Urgente')
    })

    it('quitar la prioridad en ClickUp (priority null) la quita en la app', async () => {
      const id = await crearVinculado({ prioridad: 'Alta' })
      await aplicar(tarea({ priority: null }))
      expect(await prioridadDe(id)).toBeNull()
    })

    it('si la tarea no trae el campo priority, la prioridad de la app no cambia', async () => {
      const id = await crearVinculado({ prioridad: 'Alta' })
      await aplicar(tarea())
      expect(await prioridadDe(id)).toBe('Alta')
    })

    it('una prioridad desconocida se ignora y conserva la actual', async () => {
      const id = await crearVinculado({ prioridad: 'Alta' })
      await aplicar(tarea({ priority: { id: '9', priority: 'critica' } }))
      expect(await prioridadDe(id)).toBe('Alta')
    })

    it('el cambio que viene de ClickUp no se devuelve a ClickUp', async () => {
      const id = await crearVinculado({ prioridad: 'Baja' })
      await habilitar()
      await aplicar(tarea({ priority: { id: '2', priority: 'high' } }))
      expect(await prioridadDe(id)).toBe('Alta')
      expect(await cola()).toEqual([])
    })

    it('si la app cambió después, gana la app y la prioridad de ClickUp se ignora', async () => {
      const id = await crearVinculado({ prioridad: 'Baja' })
      await aplicar(tarea({ date_updated: String(Date.now() - 3_600_000 * 2), priority: { id: '1', priority: 'urgent' } }))
      expect(await prioridadDe(id)).toBe('Baja')
      expect((await unaFila(base, 'select count(*)::int as n from public.clickup_cola')).n).toBe(0)
    })
  })
})
