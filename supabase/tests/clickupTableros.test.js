import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { comoRol, crearBase, escalar, filas, guardarItem, ITEM_BASE, unaFila } from './helpers/baseDeDatos.js'

const DESARROLLO = 1
const ANALITICA = 2
const AIR_E = 1
const ACUACAR = 2
const SEGUNDOS = 1000

const ms = (desplazamientoSegundos = 60) => String(Date.now() + desplazamientoSegundos * SEGUNDOS)

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
  list: { id: 'L-DEF', name: 'General' },
  ...extra,
})

describe('integración con ClickUp · tableros', () => {
  let base
  let luis
  let ana
  let invitado

  const habilitar = () => base.query('update public.clickup_config set habilitado = true')
  const destino = (tablero, cliente, lista) =>
    base.query(`insert into public.clickup_destino (tablero_id, cliente_id, lista_id, lista_nombre) values ($1, $2, $3, $3)`, [
      tablero,
      cliente,
      lista,
    ])
  const resolver = (tablero, cliente) =>
    escalar(base, 'select lista_id from public.destino_clickup($1, $2)', [tablero, cliente])
  const cola = () => filas(base, 'select item_id::int, accion, estado, error from public.clickup_cola order by id')
  const aplicar = (datos, evento = 'taskUpdated') =>
    escalar(base, 'select public.aplicar_cambio_clickup($1::jsonb, $2, $3)', [JSON.stringify(datos), evento, null])
  const persona = async (nombre, correo, tablero) =>
    escalar(
      base,
      `insert into public.persona (nombre, correo, tipo, tablero_id) values ($1, $2, 'equipo', $3) returning id::int`,
      [nombre, correo, tablero],
    )
  const crearVinculado = async (datos = {}, lista = 'L-DEV', tareaId = 'T-1') => {
    const { id } = await guardarItem(base, { ...ITEM_BASE, ...datos })
    await base.query(
      `update public.item set clickup_task_id = $2, clickup_url = 'https://x', clickup_lista_id = $3,
              clickup_sync_en = now() - interval '1 hour' where id = $1`,
      [id, tareaId, lista],
    )
    return id
  }
  const itemPorTarea = (tareaId) =>
    unaFila(
      base,
      `select id::int, estado, responsable_id::int, clickup_lista_id, cliente_id::int from public.item where clickup_task_id = $1`,
      [tareaId],
    )

  beforeEach(async () => {
    base = await crearBase()
    await base.query(`insert into public.cliente (nombre) values ('AIR-E'), ('ACUACAR')`)
    await base.query(`insert into public.clickup_tablero (nombre) values ('Desarrollo'), ('Analítica')`)
    luis = await persona('Luis Kendor', 'lkendor@ises.com.co', DESARROLLO)
    ana = await persona('Ana Datos', 'adatos@ises.com.co', ANALITICA)
    invitado = await persona('Iván Libre', 'ilibre@ises.com.co', null)
  })
  afterEach(() => base.close())

  describe('modelo', () => {
    it('el nombre del tablero es obligatorio y único sin distinguir mayúsculas', async () => {
      await expect(base.query(`insert into public.clickup_tablero (nombre) values ('  ')`)).rejects.toThrow()
      await expect(base.query(`insert into public.clickup_tablero (nombre) values ('desarrollo ')`)).rejects.toThrow()
    })

    it('la unicidad del destino es por tablero y cliente tratando NULL como igual', async () => {
      await destino(null, null, 'L-1')
      await expect(destino(null, null, 'L-2')).rejects.toThrow()
      await destino(DESARROLLO, null, 'L-3')
      await expect(destino(DESARROLLO, null, 'L-4')).rejects.toThrow()
      await destino(DESARROLLO, AIR_E, 'L-5')
      await expect(destino(DESARROLLO, AIR_E, 'L-6')).rejects.toThrow()
      await destino(ANALITICA, AIR_E, 'L-7')
      await destino(null, AIR_E, 'L-8')
      await expect(destino(null, AIR_E, 'L-9')).rejects.toThrow()
      expect((await cola()).length).toBe(0)
    })

    it('borrar un tablero libera a las personas y elimina sus destinos', async () => {
      await destino(ANALITICA, null, 'L-AN')
      await destino(null, null, 'L-DEF')
      await base.query('delete from public.clickup_tablero where id = $1', [ANALITICA])
      expect((await unaFila(base, 'select tablero_id from public.persona where id = $1', [ana])).tablero_id).toBeNull()
      expect(await filas(base, 'select lista_id from public.clickup_destino')).toEqual([{ lista_id: 'L-DEF' }])
    })

    it('la acción mover es válida en la cola', async () => {
      const { id } = await guardarItem(base, ITEM_BASE)
      await base.query(`insert into public.clickup_cola (item_id, accion) values ($1, 'mover')`, [id])
      expect((await cola())[0].accion).toBe('mover')
    })

    it('auditoría registra los cambios de tablero', async () => {
      const [{ id }] = await filas(base, `insert into public.clickup_tablero (nombre) values ('Soporte') returning id::int`)
      const registros = await filas(base, `select accion, detalle from public.auditoria where entidad = 'clickup_tablero' and entidad_id = $1`, [id])
      expect(registros).toEqual([{ accion: 'crear', detalle: 'Soporte' }])
    })
  })

  describe('vistas y personas', () => {
    it('v_persona expone tablero_id y tablero', async () => {
      const fila = await unaFila(base, 'select tablero_id::int, tablero from public.v_persona where id = $1', [ana])
      expect(fila).toEqual({ tablero_id: ANALITICA, tablero: 'Analítica' })
      const libre = await unaFila(base, 'select tablero_id, tablero from public.v_persona where id = $1', [invitado])
      expect(libre).toEqual({ tablero_id: null, tablero: null })
    })

    it('v_item expone el tablero del responsable', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, responsable_id: ana })
      const fila = await unaFila(base, 'select tablero_id::int, tablero, clickup_lista_id from public.v_item where id = $1', [id])
      expect(fila).toEqual({ tablero_id: ANALITICA, tablero: 'Analítica', clickup_lista_id: null })
    })

    it('un ítem sin responsable no tiene tablero', async () => {
      const { id } = await guardarItem(base, ITEM_BASE)
      expect(await unaFila(base, 'select tablero_id, tablero from public.v_item where id = $1', [id])).toEqual({
        tablero_id: null,
        tablero: null,
      })
    })

    it('v_bloqueante_abierto sigue funcionando tras recrear las vistas', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, bloqueado: true, motivo_bloqueo: 'Falta API' })
      expect(await filas(base, 'select item_id::int from public.v_bloqueante_abierto')).toEqual([{ item_id: id }])
    })

    it('guardar_persona crea con tablero_id', async () => {
      const id = await escalar(
        base,
        `select public.guardar_persona('{"nombre":"Nueva","tipo":"equipo","tablero_id":2}'::jsonb, '{}'::bigint[])::int`,
      )
      expect((await unaFila(base, 'select tablero_id::int from public.persona where id = $1', [id])).tablero_id).toBe(ANALITICA)
    })

    it('guardar_persona edita el tablero, lo conserva si no viene la clave y lo limpia con null', async () => {
      const editar = (datos) =>
        base.query(`select public.guardar_persona($1::jsonb, '{}'::bigint[], $2)`, [JSON.stringify({ nombre: 'Ana Datos', tipo: 'equipo', ...datos }), ana])
      const tablero = async () => (await unaFila(base, 'select tablero_id::int from public.persona where id = $1', [ana])).tablero_id
      await editar({ tablero_id: DESARROLLO })
      expect(await tablero()).toBe(DESARROLLO)
      await editar({ rol: 'QA' })
      expect(await tablero()).toBe(DESARROLLO)
      await editar({ tablero_id: null })
      expect(await tablero()).toBeNull()
    })

    it('guardar_persona sigue aceptando datos sin tablero (compatibilidad)', async () => {
      const id = await escalar(base, `select public.guardar_persona('{"nombre":"Vieja","tipo":"stakeholder"}'::jsonb, '{}'::bigint[])::int`)
      expect((await unaFila(base, 'select tablero_id from public.persona where id = $1', [id])).tablero_id).toBeNull()
    })
  })

  describe('enrutado de destino', () => {
    beforeEach(async () => {
      await destino(null, null, 'L-DEFECTO')
      await destino(null, AIR_E, 'L-CLIENTE')
      await destino(ANALITICA, null, 'L-ANALITICA')
      await destino(ANALITICA, AIR_E, 'L-ANALITICA-AIRE')
    })

    it('prioridad 1: tablero y cliente', async () => {
      expect(await resolver(ANALITICA, AIR_E)).toBe('L-ANALITICA-AIRE')
    })

    it('prioridad 2: tablero sin cliente', async () => {
      expect(await resolver(ANALITICA, ACUACAR)).toBe('L-ANALITICA')
    })

    it('prioridad 3: sin tablero con cliente', async () => {
      expect(await resolver(DESARROLLO, AIR_E)).toBe('L-CLIENTE')
      expect(await resolver(null, AIR_E)).toBe('L-CLIENTE')
    })

    it('prioridad 4: destino por defecto global', async () => {
      expect(await resolver(DESARROLLO, ACUACAR)).toBe('L-DEFECTO')
      expect(await resolver(null, null)).toBe('L-DEFECTO')
    })

    it('el tablero específico gana al cliente específico sin tablero', async () => {
      await base.query(`delete from public.clickup_destino where lista_id = 'L-ANALITICA-AIRE'`)
      expect(await resolver(ANALITICA, AIR_E)).toBe('L-ANALITICA')
    })

    it('sin ninguna coincidencia no hay destino', async () => {
      await base.query('delete from public.clickup_destino')
      expect(await resolver(ANALITICA, AIR_E)).toBeNull()
    })

    it('crear un ítem encola en create usando el tablero de su responsable', async () => {
      await habilitar()
      const { id } = await guardarItem(base, { ...ITEM_BASE, responsable_id: ana })
      expect(await cola()).toEqual([{ item_id: id, accion: 'create', estado: 'Pendiente', error: null }])
    })
  })

  describe('ítems sin destino', () => {
    it('no se encola: queda como Fallida con el motivo y el ítem sí se guarda', async () => {
      await habilitar()
      const { id } = await guardarItem(base, { ...ITEM_BASE, responsable_id: ana })
      expect(await cola()).toEqual([
        { item_id: id, accion: 'create', estado: 'Fallida', error: 'Sin destino configurado para Analítica / AIR-E' },
      ])
      expect((await unaFila(base, 'select count(*)::int n from public.item where id = $1', [id])).n).toBe(1)
    })

    it('sin tablero ni cliente nombra ambos huecos', async () => {
      await habilitar()
      const { id } = await guardarItem(base, { funcionalidad: 'Suelto' })
      expect((await cola())[0]).toMatchObject({
        item_id: id,
        estado: 'Fallida',
        error: 'Sin destino configurado para (sin tablero) / (sin cliente)',
      })
    })

    it('repetir ediciones no duplica el registro de error', async () => {
      await habilitar()
      const { id } = await guardarItem(base, { ...ITEM_BASE, responsable_id: ana })
      await guardarItem(base, { estado: 'En curso' }, { id })
      await guardarItem(base, { alcance: 'Mobile' }, { id })
      expect(await cola()).toHaveLength(1)
    })

    it('cuando hay destino configurado ya no registra fallos', async () => {
      await destino(null, null, 'L-DEF')
      await habilitar()
      await guardarItem(base, { ...ITEM_BASE, responsable_id: ana })
      expect((await cola())[0].estado).toBe('Pendiente')
    })

    it('contar_items_sin_destino_clickup cuenta solo ítems abiertos sin destino', async () => {
      await destino(DESARROLLO, null, 'L-DEV')
      await guardarItem(base, { ...ITEM_BASE, responsable_id: luis })
      await guardarItem(base, { ...ITEM_BASE, funcionalidad: 'Otro', responsable_id: ana })
      await guardarItem(base, { ...ITEM_BASE, funcionalidad: 'Cerrado', responsable_id: ana, estado: 'Terminado' })
      expect(await escalar(base, 'select public.contar_items_sin_destino_clickup()')).toBe(1)
    })

    it('encolar_sin_vincular_clickup omite los ítems sin destino', async () => {
      await destino(DESARROLLO, null, 'L-DEV')
      const { id } = await guardarItem(base, { ...ITEM_BASE, responsable_id: luis })
      await guardarItem(base, { ...ITEM_BASE, funcionalidad: 'Sin destino', responsable_id: ana })
      expect(await escalar(base, 'select public.encolar_sin_vincular_clickup()')).toBe(1)
      expect(await cola()).toEqual([{ item_id: id, accion: 'create', estado: 'Pendiente', error: null }])
    })
  })

  describe('mapeo de estados efectivo', () => {
    it('sin mapeo propio usa el global', async () => {
      const mapeo = await escalar(base, 'select public.mapeo_estados_clickup($1)', [DESARROLLO])
      expect(mapeo['En curso']).toBe('en desarrollo')
    })

    it('el mapeo del tablero reemplaza solo los estados que define', async () => {
      await base.query(`update public.clickup_tablero set mapeo_estados = '{"En curso":"analizando"}'::jsonb where id = $1`, [ANALITICA])
      const mapeo = await escalar(base, 'select public.mapeo_estados_clickup($1)', [ANALITICA])
      expect(mapeo['En curso']).toBe('analizando')
      expect(mapeo.Terminado).toBe('entregado')
    })

    it('sin tablero o con tablero inexistente devuelve el global', async () => {
      expect((await escalar(base, 'select public.mapeo_estados_clickup(null)'))['En curso']).toBe('en desarrollo')
      expect((await escalar(base, 'select public.mapeo_estados_clickup(999)'))['En curso']).toBe('en desarrollo')
    })
  })

  describe('mover por cambio de responsable', () => {
    beforeEach(async () => {
      await destino(DESARROLLO, null, 'L-DEV')
      await destino(ANALITICA, null, 'L-AN')
      await destino(null, null, 'L-DEF')
    })

    it('encola mover cuando el nuevo responsable pertenece a otro tablero', async () => {
      const id = await crearVinculado({ responsable_id: luis })
      await habilitar()
      await guardarItem(base, { responsable_id: ana }, { id })
      expect(await cola()).toEqual([{ item_id: id, accion: 'mover', estado: 'Pendiente', error: null }])
    })

    it('encola update cuando el responsable cambia dentro del mismo tablero', async () => {
      const otro = await persona('Otro Dev', 'otro@ises.com.co', DESARROLLO)
      const id = await crearVinculado({ responsable_id: luis })
      await habilitar()
      await guardarItem(base, { responsable_id: otro }, { id })
      expect((await cola())[0].accion).toBe('update')
    })

    it('encola update cuando la lista actual todavía no se conoce', async () => {
      const id = await crearVinculado({ responsable_id: luis }, null)
      await base.query('update public.item set clickup_lista_id = null where id = $1', [id])
      await habilitar()
      await guardarItem(base, { responsable_id: ana }, { id })
      expect((await cola())[0].accion).toBe('update')
    })

    it('un responsable sin tablero lleva la tarea al destino por defecto', async () => {
      const id = await crearVinculado({ responsable_id: luis })
      await habilitar()
      await guardarItem(base, { responsable_id: invitado }, { id })
      expect((await cola())[0].accion).toBe('mover')
    })

    it('cambiar el cliente hacia otro destino también mueve', async () => {
      await destino(DESARROLLO, ACUACAR, 'L-DEV-ACUACAR')
      const id = await crearVinculado({ responsable_id: luis })
      await habilitar()
      await guardarItem(base, { cliente: 'ACUACAR' }, { id })
      expect((await cola())[0].accion).toBe('mover')
    })

    it('un update pendiente se convierte en mover', async () => {
      const id = await crearVinculado({ responsable_id: luis })
      await habilitar()
      await guardarItem(base, { estado: 'En curso' }, { id })
      await guardarItem(base, { responsable_id: ana }, { id })
      expect(await cola()).toEqual([{ item_id: id, accion: 'mover', estado: 'Pendiente', error: null }])
    })

    it('un create pendiente se mantiene como create', async () => {
      await habilitar()
      const { id } = await guardarItem(base, { ...ITEM_BASE, responsable_id: luis })
      await guardarItem(base, { responsable_id: ana }, { id })
      expect(await cola()).toEqual([{ item_id: id, accion: 'create', estado: 'Pendiente', error: null }])
    })

    it('eliminar el ítem tras un mover pendiente lo convierte en archive', async () => {
      const id = await crearVinculado({ responsable_id: luis })
      await habilitar()
      await guardarItem(base, { responsable_id: ana }, { id })
      await base.query('select public.eliminar_item($1)', [id])
      expect(await cola()).toEqual([{ item_id: id, accion: 'archive', estado: 'Pendiente', error: null }])
    })

    it('sin destino para el nuevo responsable registra el fallo, no mueve y envía la actualización', async () => {
      await base.query(`delete from public.clickup_destino where lista_id = 'L-DEF'`)
      const id = await crearVinculado({ responsable_id: luis })
      await habilitar()
      await guardarItem(base, { responsable_id: invitado }, { id })
      expect(await cola()).toEqual([
        { item_id: id, accion: 'mover', estado: 'Fallida', error: 'Sin destino configurado para (sin tablero) / AIR-E' },
        { item_id: id, accion: 'update', estado: 'Pendiente', error: null },
      ])
    })

    it('un ítem que vive en una lista sin destino (por ejemplo de sprint) no se devuelve a su tablero', async () => {
      const id = await crearVinculado({ responsable_id: luis }, 'L-SPRINT')
      await habilitar()
      await guardarItem(base, { responsable_id: ana }, { id })
      expect(await cola()).toEqual([{ item_id: id, accion: 'update', estado: 'Pendiente', error: null }])
    })

    it('un ítem sin destino configurado igual envía sus actualizaciones', async () => {
      await base.query('delete from public.clickup_destino')
      const id = await crearVinculado({ responsable_id: luis }, 'L-SPRINT')
      await habilitar()
      await guardarItem(base, { estado: 'En curso' }, { id })
      expect(await cola()).toEqual([{ item_id: id, accion: 'update', estado: 'Pendiente', error: null }])
    })

    it('no encola nada si la integración está deshabilitada', async () => {
      const id = await crearVinculado({ responsable_id: luis })
      await guardarItem(base, { responsable_id: ana }, { id })
      expect(await cola()).toEqual([])
    })
  })

  describe('listas sin destino', () => {
    it('_lista_con_destino_clickup distingue listas mapeadas, desconocidas y nulas', async () => {
      await destino(null, null, 'L-DEF')
      const consultar = (lista) => escalar(base, 'select public._lista_con_destino_clickup($1)', [lista])
      expect(await consultar('L-DEF')).toBe(true)
      expect(await consultar('L-SPRINT')).toBe(false)
      expect(await consultar(null)).toBe(false)
    })

    it('el cambio de tablero de la persona no mueve ítems de listas ajenas al plan', async () => {
      await destino(DESARROLLO, null, 'L-DEV')
      await destino(ANALITICA, null, 'L-AN')
      await crearVinculado({ responsable_id: luis }, 'L-SPRINT')
      await habilitar()
      await base.query('update public.persona set tablero_id = $2 where id = $1', [luis, ANALITICA])
      expect(await cola()).toEqual([])
    })
  })

  describe('mover por cambio de tablero de la persona', () => {
    beforeEach(async () => {
      await destino(DESARROLLO, null, 'L-DEV')
      await destino(ANALITICA, null, 'L-AN')
    })

    const cambiarTablero = (personaId, tablero) =>
      base.query('update public.persona set tablero_id = $2 where id = $1', [personaId, tablero])

    it('encola mover para los ítems abiertos y vinculados de la persona', async () => {
      const a = await crearVinculado({ responsable_id: luis, funcionalidad: 'A' }, 'L-DEV', 'T-A')
      const b = await crearVinculado({ responsable_id: luis, funcionalidad: 'B' }, 'L-DEV', 'T-B')
      await habilitar()
      await cambiarTablero(luis, ANALITICA)
      expect(await cola()).toEqual([
        { item_id: a, accion: 'mover', estado: 'Pendiente', error: null },
        { item_id: b, accion: 'mover', estado: 'Pendiente', error: null },
      ])
    })

    it('ignora ítems cerrados, eliminados, sin vincular, sin lista conocida o de otra persona', async () => {
      await crearVinculado({ responsable_id: luis, funcionalidad: 'Cerrado', estado: 'Terminado' }, 'L-DEV', 'T-1')
      await crearVinculado({ responsable_id: luis, funcionalidad: 'Suspendido', estado: 'Suspendido' }, 'L-DEV', 'T-2')
      const eliminado = await crearVinculado({ responsable_id: luis, funcionalidad: 'Eliminado' }, 'L-DEV', 'T-3')
      await guardarItem(base, { ...ITEM_BASE, funcionalidad: 'Sin vincular', responsable_id: luis })
      const sinLista = await crearVinculado({ responsable_id: luis, funcionalidad: 'Sin lista' }, 'L-DEV', 'T-4')
      await base.query('update public.item set clickup_lista_id = null where id = $1', [sinLista])
      await crearVinculado({ responsable_id: ana, funcionalidad: 'De Ana' }, 'L-AN', 'T-5')
      await base.query('select public.eliminar_item($1)', [eliminado])
      await habilitar()
      await cambiarTablero(luis, ANALITICA)
      expect(await cola()).toEqual([])
    })

    it('no encola si el ítem ya vive en la lista que le corresponde', async () => {
      await crearVinculado({ responsable_id: luis }, 'L-AN')
      await habilitar()
      await cambiarTablero(luis, ANALITICA)
      expect(await cola()).toEqual([])
    })

    it('registra el fallo si el nuevo tablero no tiene destino', async () => {
      const [{ id: soporte }] = await filas(base, `insert into public.clickup_tablero (nombre) values ('Soporte') returning id::int`)
      const id = await crearVinculado({ responsable_id: luis })
      await habilitar()
      await cambiarTablero(luis, soporte)
      expect(await cola()).toEqual([
        { item_id: id, accion: 'mover', estado: 'Fallida', error: 'Sin destino configurado para Soporte / AIR-E' },
      ])
    })

    it('editar otros datos de la persona no encola nada', async () => {
      await crearVinculado({ responsable_id: luis })
      await habilitar()
      await base.query(`update public.persona set rol = 'QA' where id = $1`, [luis])
      expect(await cola()).toEqual([])
    })

    it('respeta la marca de origen ClickUp', async () => {
      await crearVinculado({ responsable_id: luis })
      await habilitar()
      await base.query(`select set_config('po.origen', 'clickup', false)`)
      await cambiarTablero(luis, ANALITICA)
      await base.query(`select set_config('po.origen', '', false)`)
      expect(await cola()).toEqual([])
    })

    it('guardar_persona con otro tablero dispara el mover', async () => {
      const id = await crearVinculado({ responsable_id: luis })
      await habilitar()
      await base.query(
        `select public.guardar_persona($1::jsonb, '{}'::bigint[], $2)`,
        [JSON.stringify({ nombre: 'Luis Kendor', tipo: 'equipo', tablero_id: ANALITICA }), luis],
      )
      expect(await cola()).toEqual([{ item_id: id, accion: 'mover', estado: 'Pendiente', error: null }])
    })
  })

  describe('aplicar_cambio_clickup con tableros', () => {
    beforeEach(async () => {
      await destino(DESARROLLO, null, 'L-DEV')
      await destino(ANALITICA, AIR_E, 'L-AN')
      await destino(null, null, 'L-DEF')
    })

    it('una tarea nueva en la lista de un tablero crea el ítem con el cliente del destino', async () => {
      const resultado = await aplicar(tarea({ list: { id: 'L-AN' }, assignees: [{ id: 7, email: 'adatos@ises.com.co' }] }))
      expect(resultado.resultado).toBe('creado')
      expect(await itemPorTarea('T-1')).toMatchObject({ responsable_id: ana, clickup_lista_id: 'L-AN', cliente_id: AIR_E })
      expect(await cola()).toEqual([])
    })

    it('lee el estado con el mapeo del tablero de la lista', async () => {
      await base.query(`update public.clickup_tablero set mapeo_estados = '{"En curso":"analizando"}'::jsonb where id = $1`, [ANALITICA])
      await aplicar(tarea({ list: { id: 'L-AN' }, status: { status: 'analizando', type: 'custom' } }))
      expect((await itemPorTarea('T-1')).estado).toBe('En curso')
    })

    it('un estado propio de otro tablero no se reconoce con el mapeo global', async () => {
      await base.query(`update public.clickup_tablero set mapeo_estados = '{"En curso":"analizando"}'::jsonb where id = $1`, [ANALITICA])
      await aplicar(tarea({ list: { id: 'L-DEV' }, status: { status: 'analizando', type: 'custom' } }))
      expect((await itemPorTarea('T-1')).estado).toBe('No iniciado')
    })

    it('cambiar el asignado a alguien de otro tablero actualiza el responsable y encola mover', async () => {
      const id = await crearVinculado({ responsable_id: luis }, 'L-DEV')
      const resultado = await aplicar(tarea({ list: { id: 'L-DEV' }, assignees: [{ id: 7, email: 'adatos@ises.com.co' }] }))
      expect(resultado.resultado).toBe('actualizado')
      expect((await itemPorTarea('T-1')).responsable_id).toBe(ana)
      expect(await cola()).toEqual([{ item_id: id, accion: 'mover', estado: 'Pendiente', error: null }])
    })

    it('un asignado sin tablero lleva la tarea al destino por defecto', async () => {
      const id = await crearVinculado({ responsable_id: luis }, 'L-DEV')
      await aplicar(tarea({ list: { id: 'L-DEV' }, assignees: [{ id: 9, email: 'ilibre@ises.com.co' }] }))
      expect((await itemPorTarea('T-1')).responsable_id).toBe(invitado)
      expect(await cola()).toEqual([{ item_id: id, accion: 'mover', estado: 'Pendiente', error: null }])
    })

    it('un asignado del mismo tablero que la lista no mueve nada', async () => {
      await crearVinculado({ responsable_id: invitado }, 'L-DEV')
      await aplicar(tarea({ list: { id: 'L-DEV' }, assignees: [{ id: 5, email: 'lkendor@ises.com.co' }] }))
      expect(await cola()).toEqual([])
    })

    it('una tarea sin asignado conserva su lista y no encola mover', async () => {
      await crearVinculado({ responsable_id: luis }, 'L-DEV')
      await aplicar(tarea({ list: { id: 'L-DEV' }, assignees: [] }))
      expect((await itemPorTarea('T-1')).responsable_id).toBeNull()
      expect(await cola()).toEqual([])
    })

    it('tarea creada en ClickUp con asignado de otro tablero conserva el responsable y encola mover', async () => {
      await aplicar(tarea({ list: { id: 'L-DEV' }, assignees: [{ id: 7, email: 'adatos@ises.com.co' }] }))
      const item = await itemPorTarea('T-1')
      expect(item.responsable_id).toBe(ana)
      expect(await cola()).toEqual([{ item_id: item.id, accion: 'mover', estado: 'Pendiente', error: null }])
    })

    it('una tarea movida a mano a una lista sin destino no se devuelve', async () => {
      await crearVinculado({ responsable_id: luis }, 'L-DEV')
      await aplicar(tarea({ list: { id: 'L-SPRINT' }, assignees: [{ id: 7, email: 'adatos@ises.com.co' }] }))
      expect((await itemPorTarea('T-1')).clickup_lista_id).toBe('L-SPRINT')
      expect(await cola()).toEqual([])
    })

    it('no encola mover si el destino que le corresponde no existe', async () => {
      await base.query(`delete from public.clickup_destino where lista_id = 'L-DEF'`)
      await aplicar(tarea({ list: { id: 'L-DEV' }, assignees: [{ id: 9, email: 'ilibre@ises.com.co' }] }))
      expect(await cola()).toEqual([])
    })

    it('un cambio más antiguo que el de la app se ignora y no encola mover', async () => {
      await crearVinculado({ responsable_id: luis }, 'L-DEV')
      const resultado = await aplicar(
        tarea({ list: { id: 'L-DEV' }, date_updated: ms(-7200), assignees: [{ id: 7, email: 'adatos@ises.com.co' }] }),
      )
      expect(resultado.resultado).toBe('ignorado')
      expect(await cola()).toEqual([])
    })

    it('el eco de la propia escritura no se vuelve a aplicar', async () => {
      const id = await crearVinculado({ responsable_id: luis }, 'L-DEV')
      const marca = Date.now() + 120 * SEGUNDOS
      await base.query('update public.item set clickup_sync_en = to_timestamp($2 / 1000.0) where id = $1', [id, marca])
      const resultado = await aplicar(tarea({ list: { id: 'L-DEV' }, date_updated: String(marca - 1000) }))
      expect(resultado.resultado).toBe('ignorado')
    })

    it('guarda la lista actual de la tarea en el ítem vinculado', async () => {
      await crearVinculado({ responsable_id: luis }, 'L-ANTIGUA')
      await aplicar(tarea({ list: { id: 'L-DEV' }, assignees: [{ id: 5, email: 'lkendor@ises.com.co' }] }))
      expect((await itemPorTarea('T-1')).clickup_lista_id).toBe('L-DEV')
    })

    it('la lista con destino por tablero y por cliente prefiere el cliente para clasificar', async () => {
      await destino(ANALITICA, ACUACAR, 'L-AN-ACUACAR')
      await aplicar(tarea({ id: 'T-9', list: { id: 'L-AN-ACUACAR' } }))
      expect((await itemPorTarea('T-9')).cliente_id).toBe(ACUACAR)
    })
  })

  describe('permisos', () => {
    it('los usuarios autenticados administran los tableros; los anónimos no los ven', async () => {
      await comoRol(base, 'authenticated', () => base.query(`insert into public.clickup_tablero (nombre) values ('Soporte')`))
      const visibles = await comoRol(base, 'authenticated', () => filas(base, 'select nombre from public.clickup_tablero order by id'))
      expect(visibles.map((t) => t.nombre)).toEqual(['Desarrollo', 'Analítica', 'Soporte'])
      const anonimo = await comoRol(base, 'anon', () => filas(base, 'select * from public.clickup_tablero'))
      expect(anonimo).toEqual([])
    })

    it('los usuarios autenticados y anónimos no ejecutan las funciones internas', async () => {
      for (const rol of ['authenticated', 'anon']) {
        for (const sql of [
          'select public.mapeo_estados_clickup(1)',
          'select public.contar_items_sin_destino_clickup()',
          'select public.encolar_sin_vincular_clickup()',
          'select public._encolar_clickup(1, \'update\')',
        ]) {
          await expect(comoRol(base, rol, () => base.query(sql))).rejects.toThrow(/permission denied/)
        }
      }
    })

    it('service_role sí las ejecuta', async () => {
      await comoRol(base, 'service_role', async () => {
        await base.query('select public.mapeo_estados_clickup(1)')
        await base.query('select public.contar_items_sin_destino_clickup()')
      })
    })

    it('un usuario autenticado puede guardar una persona con tablero y mover ítems vinculados', async () => {
      await destino(DESARROLLO, null, 'L-DEV')
      await destino(ANALITICA, null, 'L-AN')
      const id = await crearVinculado({ responsable_id: luis })
      await habilitar()
      await comoRol(base, 'authenticated', () =>
        base.query(`select public.guardar_persona($1::jsonb, '{}'::bigint[], $2)`, [
          JSON.stringify({ nombre: 'Luis Kendor', tipo: 'equipo', tablero_id: ANALITICA }),
          luis,
        ]),
      )
      expect(await cola()).toEqual([{ item_id: id, accion: 'mover', estado: 'Pendiente', error: null }])
    })
  })
})
