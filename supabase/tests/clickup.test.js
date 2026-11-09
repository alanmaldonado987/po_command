import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { comoRol, crearBase, escalar, filas, guardarItem, ITEM_BASE, unaFila } from './helpers/baseDeDatos.js'

const LISTA = 'L-100'
const SEGUNDOS = 1000

const ms = (desplazamientoSegundos = 60) => String(Date.now() + desplazamientoSegundos * SEGUNDOS)
const mediodiaBogota = (fecha) => String(Date.parse(`${fecha}T12:00:00-05:00`))

const tarea = (extra = {}) => ({
  id: 'T-1',
  name: 'Mapa de rutas',
  status: { status: 'en desarrollo', type: 'custom' },
  date_updated: ms(),
  archived: false,
  assignees: [],
  tags: [],
  due_date: null,
  start_date: null,
  url: 'https://app.clickup.com/t/T-1',
  list: { id: LISTA, name: 'AIR-E' },
  ...extra,
})

describe('integración con ClickUp', () => {
  let base

  const habilitar = () => base.query('update public.clickup_config set habilitado = true')
  const aplicar = (datos, evento = 'taskUpdated', clienteId = null) =>
    escalar(base, 'select public.aplicar_cambio_clickup($1::jsonb, $2, $3)', [JSON.stringify(datos), evento, clienteId])
  const cola = () => filas(base, 'select item_id::int, accion, estado from public.clickup_cola order by id')
  const itemPorTarea = (tareaId) =>
    unaFila(
      base,
      `select id::int, codigo, funcionalidad, estado, alcance, fase, plan_ini::text, plan_fin::text, plan_pruebas_fin::text,
              responsable_id::int, bloqueado, motivo_bloqueo, eliminado_en, clickup_task_id, clickup_url,
              clickup_sync_en, actividad_id::int, modulo_id::int, real_ini::text, descripcion
         from public.item where clickup_task_id = $1`,
      [tareaId],
    )
  const crearVinculado = async (datos = {}, tareaId = 'T-1') => {
    const { id } = await guardarItem(base, { ...ITEM_BASE, ...datos })
    await base.query(
      `update public.item set clickup_task_id = $2, clickup_url = 'https://x', clickup_sync_en = now() - interval '1 hour' where id = $1`,
      [id, tareaId],
    )
    return id
  }

  beforeEach(async () => {
    base = await crearBase()
    await base.query(`insert into public.cliente (nombre) values ('AIR-E')`)
    await base.query(`insert into public.clickup_destino (cliente_id, lista_id, lista_nombre) values (1, $1, 'AIR-E')`, [LISTA])
    await base.query(
      `insert into public.persona (nombre, correo, tipo) values ('Luis Kendor', 'lkendor@ises.com.co', 'equipo'), ('Dairo Pérez', 'dperez@ises.com.co', 'equipo')`,
    )
  })
  afterEach(() => base.close())

  describe('cola de salida (triggers)', () => {
    it('no encola nada mientras la integración está deshabilitada', async () => {
      await guardarItem(base, ITEM_BASE)
      expect(await cola()).toEqual([])
    })

    it('encola un create al crear un ítem', async () => {
      await habilitar()
      const { id } = await guardarItem(base, ITEM_BASE)
      expect(await cola()).toEqual([{ item_id: id, accion: 'create', estado: 'Pendiente' }])
    })

    it('encola un update al editar un ítem ya vinculado', async () => {
      const id = await crearVinculado()
      await habilitar()
      await guardarItem(base, { estado: 'En curso' }, { id })
      expect(await cola()).toEqual([{ item_id: id, accion: 'update', estado: 'Pendiente' }])
    })

    it('colapsa varias ediciones seguidas en un solo envío pendiente', async () => {
      await habilitar()
      const { id } = await guardarItem(base, ITEM_BASE)
      await guardarItem(base, { estado: 'En curso' }, { id })
      await guardarItem(base, { alcance: 'Mobile' }, { id })
      expect(await cola()).toHaveLength(1)
    })

    it('no encola cuando la sesión marca el origen ClickUp', async () => {
      await habilitar()
      await base.query(`select set_config('po.origen', 'clickup', false)`)
      await guardarItem(base, ITEM_BASE)
      await base.query(`select set_config('po.origen', '', false)`)
      expect(await cola()).toEqual([])
    })

    it('encola un archive al eliminar un ítem vinculado', async () => {
      const id = await crearVinculado()
      await habilitar()
      await base.query('select public.eliminar_item($1)', [id])
      expect(await cola()).toEqual([{ item_id: id, accion: 'archive', estado: 'Pendiente' }])
    })

    it('convierte en archive un update pendiente si luego se elimina el ítem', async () => {
      const id = await crearVinculado()
      await habilitar()
      await guardarItem(base, { estado: 'En curso' }, { id })
      await base.query('select public.eliminar_item($1)', [id])
      expect(await cola()).toEqual([{ item_id: id, accion: 'archive', estado: 'Pendiente' }])
    })

    it('retira el create pendiente si el ítem se elimina antes de enviarse', async () => {
      await habilitar()
      const { id } = await guardarItem(base, ITEM_BASE)
      await base.query('select public.eliminar_item($1)', [id])
      expect(await cola()).toEqual([])
    })

    it('no colapsa sobre un envío que ya está reservado por el procesador', async () => {
      await habilitar()
      const { id } = await guardarItem(base, ITEM_BASE)
      await base.query(`update public.clickup_cola set reservada_hasta = now() + interval '3 minutes'`)
      await guardarItem(base, { estado: 'En curso' }, { id })
      expect(await cola()).toHaveLength(2)
    })

    it('vincular la tarea no vuelve a encolar, ni toca actualizado_en, ni audita', async () => {
      await habilitar()
      const { id } = await guardarItem(base, ITEM_BASE)
      await base.query('delete from public.clickup_cola')
      const antes = await unaFila(base, 'select actualizado_en from public.item where id = $1', [id])
      const auditorias = await escalar(base, `select count(*)::int from public.auditoria where entidad = 'item'`)
      await base.query(
        `update public.item set clickup_task_id = 'T-9', clickup_url = 'https://x', clickup_sync_en = now() where id = $1`,
        [id],
      )
      expect(await cola()).toEqual([])
      expect(await unaFila(base, 'select actualizado_en from public.item where id = $1', [id])).toEqual(antes)
      expect(await escalar(base, `select count(*)::int from public.auditoria where entidad = 'item'`)).toBe(auditorias)
    })

    it('una edición real sigue auditándose y actualizando actualizado_en', async () => {
      const id = await crearVinculado()
      const antes = await unaFila(base, 'select actualizado_en from public.item where id = $1', [id])
      await new Promise((resolver) => setTimeout(resolver, 20))
      await guardarItem(base, { estado: 'En curso' }, { id })
      const despues = await unaFila(base, 'select actualizado_en from public.item where id = $1', [id])
      expect(despues.actualizado_en.getTime()).toBeGreaterThan(antes.actualizado_en.getTime())
    })
  })

  describe('reservar_cola_clickup y encolar_sin_vincular_clickup', () => {
    it('reserva las filas pendientes una sola vez y respeta el límite', async () => {
      await habilitar()
      for (const funcionalidad of ['A', 'B', 'C']) await guardarItem(base, { ...ITEM_BASE, funcionalidad })
      const primera = await filas(base, 'select * from public.reservar_cola_clickup(2)')
      const segunda = await filas(base, 'select * from public.reservar_cola_clickup(10)')
      expect(primera).toHaveLength(2)
      expect(segunda).toHaveLength(1)
      expect(await filas(base, 'select * from public.reservar_cola_clickup(10)')).toHaveLength(0)
    })

    it('vuelve a ofrecer una fila cuya reserva venció', async () => {
      await habilitar()
      await guardarItem(base, ITEM_BASE)
      await base.query(`update public.clickup_cola set reservada_hasta = now() - interval '1 minute'`)
      expect(await filas(base, 'select * from public.reservar_cola_clickup(10)')).toHaveLength(1)
    })

    it('encola los ítems sin vincular una sola vez', async () => {
      await guardarItem(base, ITEM_BASE)
      await guardarItem(base, { ...ITEM_BASE, funcionalidad: 'Otra' })
      await crearVinculado({ funcionalidad: 'Ya enlazada' }, 'T-5')
      expect(await escalar(base, 'select public.encolar_sin_vincular_clickup()')).toBe(2)
      expect(await escalar(base, 'select public.encolar_sin_vincular_clickup()')).toBe(0)
      expect(await cola()).toHaveLength(2)
    })
  })

  describe('aplicar_cambio_clickup · crear', () => {
    it('crea un ítem vinculado desde una tarea de una lista con destino', async () => {
      const resultado = await aplicar(
        tarea({
          status: { status: 'En Desarrollo' },
          start_date: mediodiaBogota('2026-03-02'),
          due_date: mediodiaBogota('2026-03-20'),
          assignees: [{ id: 7, email: 'LKENDOR@ises.com.co' }],
          tags: [{ name: 'web' }, { name: 'Customización' }],
        }),
      )
      expect(resultado).toMatchObject({ resultado: 'creado' })
      const item = await itemPorTarea('T-1')
      expect(item).toMatchObject({
        funcionalidad: 'Mapa de rutas',
        estado: 'En curso',
        alcance: 'Web',
        fase: 'Customización',
        plan_ini: '2026-03-02',
        plan_fin: '2026-03-20',
        plan_pruebas_fin: null,
        responsable_id: 1,
        clickup_url: 'https://app.clickup.com/t/T-1',
      })
      expect(await escalar(base, `select c.nombre from public.item i join public.cliente c on c.id = i.cliente_id`)).toBe('AIR-E')
    })

    it('no encola un envío de vuelta al crear desde ClickUp', async () => {
      await habilitar()
      await aplicar(tarea())
      expect(await cola()).toEqual([])
    })

    it('ignora una tarea de una lista sin destino configurado', async () => {
      const resultado = await aplicar(tarea({ list: { id: 'OTRA' } }))
      expect(resultado).toMatchObject({ resultado: 'ignorado', motivo: 'lista sin destino configurado' })
      expect(await itemPorTarea('T-1')).toBeUndefined()
    })

    it('usa el cliente indicado para importar tareas de una lista sin destino', async () => {
      const resultado = await aplicar(tarea({ list: { id: 'OTRA' } }), 'importar', 1)
      expect(resultado).toMatchObject({ resultado: 'creado' })
      expect(await escalar(base, `select c.nombre from public.item i join public.cliente c on c.id = i.cliente_id`)).toBe('AIR-E')
    })

    it('toma el cliente del bloque cuando la lista es el destino por defecto', async () => {
      await base.query(`insert into public.clickup_destino (cliente_id, lista_id) values (null, 'GENERAL')`)
      const bloque = '<!--po-command {"cliente":"ACUACAR","actividad":"SCR","modulo":"Órdenes"} -->'
      await aplicar(tarea({ list: { id: 'GENERAL' }, markdown_description: `Texto\n\n${bloque}` }))
      const item = await unaFila(
        base,
        `select c.nombre cliente, a.nombre actividad, m.nombre modulo
           from public.item i join public.cliente c on c.id = i.cliente_id
           join public.actividad a on a.id = i.actividad_id join public.modulo m on m.id = i.modulo_id`,
      )
      expect(item).toEqual({ cliente: 'ACUACAR', actividad: 'SCR', modulo: 'Órdenes' })
    })

    it('lee los campos estructurados del bloque en tareas nuevas', async () => {
      const bloque = JSON.stringify({
        producto: 'FieldOps',
        actividad: 'SCR',
        modulo: 'Torre de Control',
        fase: 'Desarrollo',
        alcance: 'Mobile',
        descripcion: 'Detalle del alcance',
        real_ini: '2026-02-01',
        plan_pruebas_fin: '2026-04-30',
        plan_fin: '2026-04-15',
        bloqueado: false,
      })
      await aplicar(tarea({ markdown_description: `Resumen\n\n<!--po-command ${bloque} -->`, due_date: mediodiaBogota('2026-04-30') }))
      expect(await itemPorTarea('T-1')).toMatchObject({
        alcance: 'Mobile',
        fase: 'Desarrollo',
        real_ini: '2026-02-01',
        descripcion: 'Detalle del alcance',
        plan_fin: '2026-04-15',
        plan_pruebas_fin: '2026-04-30',
      })
    })

    it('ignora un bloque dañado sin fallar', async () => {
      const resultado = await aplicar(tarea({ markdown_description: '<!--po-command {no es json -->' }))
      expect(resultado).toMatchObject({ resultado: 'creado' })
    })

    it('un título «Módulo · completo» se guarda como funcionalidad Completo', async () => {
      await aplicar(tarea({ name: 'Torre de Control · completo' }))
      const item = await unaFila(
        base,
        `select i.funcionalidad, m.nombre modulo from public.item i join public.modulo m on m.id = i.modulo_id`,
      )
      expect(item).toEqual({ funcionalidad: 'Completo', modulo: 'Torre de Control' })
    })

    it('importa el texto plano de una tarea nativa como descripción', async () => {
      await aplicar(tarea({ text_content: 'Revisar con el cliente' }))
      expect(await itemPorTarea('T-1')).toMatchObject({ descripcion: 'Revisar con el cliente' })
    })

    it('un estado cerrado de ClickUp sin mapeo equivale a Terminado', async () => {
      await aplicar(tarea({ status: { status: 'cerrada', type: 'closed' } }))
      expect(await itemPorTarea('T-1')).toMatchObject({ estado: 'Terminado' })
    })

    it('un estado desconocido deja el ítem nuevo como No iniciado', async () => {
      await aplicar(tarea({ status: { status: 'algo raro', type: 'custom' } }))
      expect(await itemPorTarea('T-1')).toMatchObject({ estado: 'No iniciado' })
    })

    it('exige que la tarea traiga id', async () => {
      await expect(aplicar({ name: 'sin id' })).rejects.toThrow(/no trae id/)
    })
  })

  describe('aplicar_cambio_clickup · actualizar', () => {
    it('actualiza estado, fechas y responsable de un ítem vinculado y registra la reprogramación', async () => {
      const id = await crearVinculado({ plan_fin: '2026-03-01', estado: 'No iniciado' })
      const resultado = await aplicar(
        tarea({
          status: { status: 'VALIDACIÓN' },
          due_date: mediodiaBogota('2026-03-25'),
          assignees: [{ id: 3, email: 'dperez@ises.com.co' }],
        }),
      )
      expect(resultado).toMatchObject({ resultado: 'actualizado', item_id: id })
      expect(await itemPorTarea('T-1')).toMatchObject({
        estado: 'Terminado, en etapa de pruebas',
        plan_fin: '2026-03-25',
        responsable_id: 2,
      })
      const nota = await unaFila(base, `select tipo, texto, autor from public.nota where item_id = $1 and tipo = 'Reprogramación'`, [id])
      expect(nota.texto).toContain('01/03/2026 → 25/03/2026')
    })

    it('guarda la fecha de ClickUp en plan_pruebas_fin cuando el ítem ya tiene fecha de pruebas', async () => {
      await crearVinculado({ plan_fin: '2026-03-01', plan_pruebas_fin: '2026-03-10' })
      await aplicar(tarea({ due_date: mediodiaBogota('2026-03-30') }))
      expect(await itemPorTarea('T-1')).toMatchObject({ plan_fin: '2026-03-01', plan_pruebas_fin: '2026-03-30' })
    })

    it('registra la sincronización y no encola un envío de vuelta', async () => {
      await habilitar()
      await crearVinculado()
      await base.query('delete from public.clickup_cola')
      const actualizada = ms(120)
      await aplicar(tarea({ date_updated: actualizada, status: { status: 'entregado' } }))
      const item = await itemPorTarea('T-1')
      expect(item.estado).toBe('Terminado')
      expect(item.clickup_sync_en.getTime()).toBe(Number(actualizada))
      expect(await cola()).toEqual([])
    })

    it('ignora el eco de una escritura propia (misma fecha de sincronización)', async () => {
      await crearVinculado()
      const sync = await escalar(base, `select (extract(epoch from clickup_sync_en) * 1000)::bigint::text from public.item`)
      const resultado = await aplicar(tarea({ date_updated: sync, status: { status: 'entregado' } }))
      expect(resultado.resultado).toBe('ignorado')
    })

    it('gana el cambio más reciente: ignora una tarea más antigua que la última edición de la app', async () => {
      await crearVinculado({ estado: 'En curso' })
      const resultado = await aplicar(tarea({ date_updated: ms(-3600), status: { status: 'entregado' } }))
      expect(resultado).toMatchObject({ resultado: 'ignorado', motivo: 'el cambio de la app es más reciente' })
      expect(await itemPorTarea('T-1')).toMatchObject({ estado: 'En curso' })
    })

    it('gana el cambio más reciente: aplica una tarea posterior a la última edición de la app', async () => {
      await crearVinculado()
      await aplicar(tarea({ date_updated: ms(5), status: { status: 'entregado' } }))
      expect(await itemPorTarea('T-1')).toMatchObject({ estado: 'Terminado' })
    })

    it('ignora el cambio mientras la app tiene un envío pendiente del mismo ítem', async () => {
      const id = await crearVinculado()
      await base.query(`insert into public.clickup_cola (item_id, accion) values ($1, 'update')`, [id])
      const resultado = await aplicar(tarea({ status: { status: 'entregado' } }))
      expect(resultado).toMatchObject({ resultado: 'ignorado', motivo: 'cambio de la app pendiente de envío' })
    })

    it('conserva el responsable si el asignado de ClickUp no está en el directorio', async () => {
      await crearVinculado({ responsable_id: 1 })
      await aplicar(tarea({ assignees: [{ id: 9, email: 'desconocido@otra.com' }] }))
      expect(await itemPorTarea('T-1')).toMatchObject({ responsable_id: 1 })
    })

    it('quita el responsable cuando la tarea queda sin asignados', async () => {
      await crearVinculado({ responsable_id: 1 })
      await aplicar(tarea({ assignees: [] }))
      expect(await itemPorTarea('T-1')).toMatchObject({ responsable_id: null })
    })

    it('no renombra el ítem cuando el nombre de la tarea es el título que la app envió', async () => {
      await crearVinculado({ funcionalidad: 'Completo', modulo: 'Torre de Control' })
      await aplicar(tarea({ name: 'Torre de Control · completo' }))
      expect(await itemPorTarea('T-1')).toMatchObject({ funcionalidad: 'Completo' })
    })

    it('renombra el ítem cuando alguien cambia el nombre en ClickUp', async () => {
      await crearVinculado()
      await aplicar(tarea({ name: 'Mapa de rutas v2' }))
      expect(await itemPorTarea('T-1')).toMatchObject({ funcionalidad: 'Mapa de rutas v2' })
    })

    it('la etiqueta bloqueado bloquea el ítem y abre un bloqueante; quitarla lo resuelve', async () => {
      const id = await crearVinculado()
      await aplicar(tarea({ date_updated: ms(10), tags: [{ name: 'bloqueado' }] }))
      expect(await itemPorTarea('T-1')).toMatchObject({ bloqueado: true, motivo_bloqueo: 'Bloqueado desde ClickUp' })
      expect(await escalar(base, 'select count(*)::int from public.bloqueante where item_id = $1 and resuelto_en is null', [id])).toBe(1)
      await aplicar(tarea({ date_updated: ms(20), tags: [] }))
      expect(await itemPorTarea('T-1')).toMatchObject({ bloqueado: false, motivo_bloqueo: '' })
      expect(await escalar(base, 'select count(*)::int from public.bloqueante where item_id = $1 and resuelto_en is null', [id])).toBe(0)
    })

    it('actualiza alcance y fase desde las etiquetas', async () => {
      await crearVinculado({ alcance: 'Web', fase: 'Desarrollo' })
      await aplicar(tarea({ tags: [{ name: 'Mobile' }, { name: 'customización' }] }))
      expect(await itemPorTarea('T-1')).toMatchObject({ alcance: 'Mobile', fase: 'Customización' })
    })

    it('no toca los campos estructurados del bloque en ítems existentes', async () => {
      await crearVinculado({ alcance: 'Web', descripcion: 'Original' })
      const bloque = '<!--po-command {"alcance":"APK","descripcion":"Intruso"} -->'
      await aplicar(tarea({ markdown_description: bloque }))
      expect(await itemPorTarea('T-1')).toMatchObject({ alcance: 'Web', descripcion: 'Original' })
    })

    it('ignora cambios sobre un ítem que ya fue eliminado en la app', async () => {
      const id = await crearVinculado()
      await base.query('select public.eliminar_item($1)', [id])
      const resultado = await aplicar(tarea({ status: { status: 'entregado' } }))
      expect(resultado).toMatchObject({ resultado: 'ignorado', motivo: 'ítem eliminado en la app' })
    })

    it('reporta sin_cambios cuando la tarea coincide con el ítem', async () => {
      await crearVinculado({ estado: 'En curso' })
      const resultado = await aplicar(tarea({ status: { status: 'en desarrollo' } }))
      expect(resultado.resultado).toBe('sin_cambios')
    })
  })

  describe('aplicar_cambio_clickup · eliminar', () => {
    it('taskDeleted elimina lógicamente el ítem vinculado sin encolar un archive', async () => {
      await habilitar()
      const id = await crearVinculado()
      await base.query('delete from public.clickup_cola')
      const resultado = await aplicar({ id: 'T-1' }, 'taskDeleted')
      expect(resultado).toMatchObject({ resultado: 'archivado', item_id: id })
      expect(await escalar(base, 'select eliminado_en is not null from public.item where id = $1', [id])).toBe(true)
      expect(await cola()).toEqual([])
    })

    it('una tarea archivada en ClickUp elimina el ítem', async () => {
      await crearVinculado()
      expect(await aplicar(tarea({ archived: true }))).toMatchObject({ resultado: 'archivado' })
    })

    it('cancela las alertas pendientes del ítem eliminado', async () => {
      const id = await crearVinculado()
      await base.query(
        `insert into public.alerta_programada (regla_codigo, entidad, entidad_id, asunto, cuerpo_html, destinatarios)
         values ('BLOQUEO_ESCALAR', 'item', $1, 'a', 'b', array['x@y.co'])`,
        [id],
      )
      await aplicar({ id: 'T-1' }, 'taskDeleted')
      expect(await escalar(base, `select estado from public.alerta_programada`)).toBe('Cancelada')
    })

    it('eliminar una tarea desconocida o ya eliminada es inofensivo', async () => {
      expect(await aplicar({ id: 'NO-EXISTE' }, 'taskDeleted')).toMatchObject({ resultado: 'ignorado' })
      await crearVinculado()
      await aplicar({ id: 'T-1' }, 'taskDeleted')
      expect(await aplicar({ id: 'T-1' }, 'taskDeleted')).toMatchObject({ resultado: 'ignorado' })
    })
  })

  describe('esquema', () => {
    it('v_item expone el vínculo con ClickUp', async () => {
      const id = await crearVinculado()
      expect(await unaFila(base, 'select clickup_task_id, clickup_url from public.v_item where id = $1', [id])).toEqual({
        clickup_task_id: 'T-1',
        clickup_url: 'https://x',
      })
    })

    it('v_bloqueante_abierto sigue funcionando tras recrear las vistas', async () => {
      await guardarItem(base, { ...ITEM_BASE, bloqueado: true, motivo_bloqueo: 'Falta API' })
      expect(await filas(base, 'select codigo, motivo from public.v_bloqueante_abierto')).toEqual([{ codigo: 'BL-001', motivo: 'Falta API' }])
    })

    it('una tarea de ClickUp solo puede vincularse a un ítem', async () => {
      await crearVinculado({}, 'T-1')
      const { id } = await guardarItem(base, { ...ITEM_BASE, funcionalidad: 'Otra' })
      await expect(base.query(`update public.item set clickup_task_id = 'T-1' where id = $1`, [id])).rejects.toThrow(/duplicate key/)
    })

    it('solo puede haber un destino por defecto y un destino por cliente', async () => {
      await base.query(`insert into public.clickup_destino (cliente_id, lista_id) values (null, 'G1')`)
      await expect(base.query(`insert into public.clickup_destino (cliente_id, lista_id) values (null, 'G2')`)).rejects.toThrow(/duplicate key/)
      await expect(base.query(`insert into public.clickup_destino (cliente_id, lista_id) values (1, 'X')`)).rejects.toThrow(/duplicate key/)
    })

    it('la cola solo acepta acciones y estados válidos', async () => {
      const { id } = await guardarItem(base, ITEM_BASE)
      await expect(base.query(`insert into public.clickup_cola (item_id, accion) values ($1, 'borrar')`, [id])).rejects.toThrow(/check/)
      await expect(
        base.query(`insert into public.clickup_cola (item_id, accion, estado) values ($1, 'create', 'Rara')`, [id]),
      ).rejects.toThrow(/check/)
    })

    it('trae un mapeo de estados por defecto con los cinco estados', async () => {
      const mapeo = await escalar(base, 'select mapeo_estados from public.clickup_config')
      expect(Object.keys(mapeo).sort()).toEqual(
        ['En curso', 'No iniciado', 'Suspendido', 'Terminado', 'Terminado, en etapa de pruebas'].sort(),
      )
    })

    it('hay una sola fila de configuración, deshabilitada por defecto', async () => {
      expect(await filas(base, 'select habilitado, token from public.clickup_config')).toEqual([{ habilitado: false, token: '' }])
    })
  })

  describe('permisos', () => {
    it('usuarios autenticados y anónimos no pueden ejecutar aplicar_cambio_clickup', async () => {
      for (const rol of ['authenticated', 'anon']) {
        await comoRol(base, rol, async () => {
          await expect(base.query(`select public.aplicar_cambio_clickup('{"id":"x"}'::jsonb)`)).rejects.toThrow(/permission denied/)
        })
      }
    })

    it('usuarios autenticados y anónimos no pueden reservar la cola ni encolar pendientes', async () => {
      for (const rol of ['authenticated', 'anon']) {
        await comoRol(base, rol, async () => {
          await expect(base.query('select * from public.reservar_cola_clickup(1)')).rejects.toThrow(/permission denied/)
          await expect(base.query('select public.encolar_sin_vincular_clickup()')).rejects.toThrow(/permission denied/)
        })
      }
    })

    it('service_role sí puede ejecutarlas', async () => {
      await comoRol(base, 'service_role', async () => {
        await expect(base.query(`select public.aplicar_cambio_clickup('{"id":"x"}'::jsonb, 'taskDeleted')`)).resolves.toBeDefined()
        await expect(base.query('select * from public.reservar_cola_clickup(1)')).resolves.toBeDefined()
      })
    })

    it('clickup_config es invisible y no se puede modificar con la sesión de un usuario', async () => {
      await base.query(`update public.clickup_config set token = 'secreto'`)
      for (const rol of ['authenticated', 'anon']) {
        await comoRol(base, rol, async () => {
          expect(await escalar(base, 'select count(*)::int from public.clickup_config')).toBe(0)
          await base.query(`update public.clickup_config set token = 'robado'`)
        })
      }
      expect(await escalar(base, 'select token from public.clickup_config')).toBe('secreto')
    })

    it('service_role lee clickup_config', async () => {
      await comoRol(base, 'service_role', async () => {
        expect(await escalar(base, 'select count(*)::int from public.clickup_config')).toBe(1)
      })
    })

    it('los usuarios autenticados administran los destinos; los anónimos no los ven', async () => {
      await comoRol(base, 'authenticated', async () => {
        await base.query(`insert into public.clickup_destino (cliente_id, lista_id, lista_nombre) values (null, 'G', 'General')`)
        expect(await escalar(base, 'select count(*)::int from public.clickup_destino')).toBe(2)
        await base.query(`delete from public.clickup_destino where lista_id = 'G'`)
      })
      await comoRol(base, 'anon', async () => {
        expect(await escalar(base, 'select count(*)::int from public.clickup_destino')).toBe(0)
      })
    })

    it('los usuarios autenticados leen la cola pero no escriben en ella', async () => {
      await habilitar()
      const { id } = await guardarItem(base, ITEM_BASE)
      await comoRol(base, 'authenticated', async () => {
        expect(await escalar(base, 'select count(*)::int from public.clickup_cola')).toBe(1)
        await expect(base.query(`insert into public.clickup_cola (item_id, accion) values ($1, 'update')`, [id])).rejects.toThrow(
          /row-level security/,
        )
      })
    })

    it('un usuario autenticado puede crear ítems aunque el trigger escriba en la cola', async () => {
      await habilitar()
      await comoRol(base, 'authenticated', async () => {
        await expect(guardarItem(base, ITEM_BASE)).resolves.toMatchObject({ codigo: 'BL-001' })
      })
      expect(await cola()).toHaveLength(1)
    })
  })
})
