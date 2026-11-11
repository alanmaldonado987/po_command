import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { comoRol, crearBase, escalar, filas, unaFila } from './helpers/baseDeDatos.js'

const LISTA = 'L-100'
const ms = (desplazamientoSegundos = 60) => String(Date.now() + desplazamientoSegundos * 1000)

const MAPEO_USUARIO = {
  'No iniciado': ['Pendiente'],
  'En curso': ['En desarrollo'],
  'Terminado, en etapa de pruebas': ['Validación', 'Listo para entregar'],
  Terminado: ['Entregado'],
}

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

describe('mapeo de estados con varios nombres de ClickUp', () => {
  let base

  const fijarMapeo = (mapeo) => base.query('update public.clickup_config set mapeo_estados = $1::jsonb', [JSON.stringify(mapeo)])
  const estadoDe = (mapeo, estado, tipo = 'custom') =>
    escalar(base, 'select public._estado_desde_clickup($1::jsonb, $2, $3)', [JSON.stringify(mapeo), estado, tipo])
  const aplicar = (datos, evento = 'taskUpdated') =>
    escalar(base, 'select public.aplicar_cambio_clickup($1::jsonb, $2, null)', [JSON.stringify(datos), evento])
  const aplicarForzado = (datos, evento = 'reconciliar') =>
    escalar(base, 'select public.aplicar_cambio_clickup($1::jsonb, $2, null, true)', [JSON.stringify(datos), evento])
  const estadoDelItem = (tareaId = 'T-1') => escalar(base, 'select estado from public.item where clickup_task_id = $1', [tareaId])

  beforeEach(async () => {
    base = await crearBase()
    await base.query(`insert into public.cliente (nombre) values ('AIR-E')`)
    await base.query(`insert into public.clickup_destino (cliente_id, lista_id, lista_nombre) values (1, $1, 'AIR-E')`, [LISTA])
  })
  afterEach(() => base.close())

  describe('_estado_desde_clickup', () => {
    it('sigue aceptando un texto por estado de la app', async () => {
      expect(await estadoDe({ 'En curso': 'en desarrollo' }, 'En Desarrollo')).toBe('En curso')
    })

    it('acepta varios nombres de ClickUp para el mismo estado de la app', async () => {
      expect(await estadoDe(MAPEO_USUARIO, 'Validación')).toBe('Terminado, en etapa de pruebas')
      expect(await estadoDe(MAPEO_USUARIO, 'Listo para entregar')).toBe('Terminado, en etapa de pruebas')
      expect(await estadoDe(MAPEO_USUARIO, 'Entregado')).toBe('Terminado')
      expect(await estadoDe(MAPEO_USUARIO, 'Pendiente')).toBe('No iniciado')
    })

    it('admite mezclar textos y listas en el mismo mapeo', async () => {
      const mapeo = { 'En curso': 'en desarrollo', Terminado: ['Entregado', 'Cerrado'] }
      expect(await estadoDe(mapeo, 'EN DESARROLLO')).toBe('En curso')
      expect(await estadoDe(mapeo, 'cerrado')).toBe('Terminado')
    })

    it.each([
      ['☑ ENTREGADO', 'Terminado'],
      ['✅ Entregado', 'Terminado'],
      ['🔍 VALIDACIÓN', 'Terminado, en etapa de pruebas'],
      ['Validacion', 'Terminado, en etapa de pruebas'],
      ['🧑‍💻 EN DESARROLLO', 'En curso'],
      ['  en   desarrollo  ', 'En curso'],
      ['LISTO-PARA_ENTREGAR!', 'Terminado, en etapa de pruebas'],
    ])('ignora emojis, símbolos, tildes, mayúsculas y espacios: «%s»', async (nombre, esperado) => {
      expect(await estadoDe(MAPEO_USUARIO, nombre)).toBe(esperado)
    })

    it('también tolera emojis y símbolos en los nombres del mapeo', async () => {
      expect(await estadoDe({ Terminado: ['☑ ENTREGADO'] }, 'entregado')).toBe('Terminado')
    })

    it('un nombre sin letras ni dígitos nunca coincide, ni siquiera con un mapeo vacío', async () => {
      expect(await estadoDe({ 'En curso': [''], Terminado: '' }, '🔍')).toBeNull()
      expect(await estadoDe({ 'En curso': [''], Terminado: '' }, '')).toBeNull()
    })

    it.each(['closed', 'done'])('el tipo %s sin coincidencia en el mapeo equivale a Terminado', async (tipo) => {
      expect(await estadoDe(MAPEO_USUARIO, 'Otro estado', tipo)).toBe('Terminado')
    })

    it('un tipo personalizado u abierto sin coincidencia no resuelve ningún estado', async () => {
      expect(await estadoDe(MAPEO_USUARIO, 'Otro estado', 'custom')).toBeNull()
      expect(await estadoDe(MAPEO_USUARIO, 'Otro estado', 'open')).toBeNull()
      expect(await estadoDe(MAPEO_USUARIO, 'Otro estado', null)).toBeNull()
    })

    it('el mapeo manda sobre el tipo: un estado mapeado como En curso no pasa a Terminado aunque sea done', async () => {
      expect(await estadoDe({ 'En curso': ['Listo'] }, 'Listo', 'done')).toBe('En curso')
    })

    it('si un nombre está en varios estados gana el primero en el orden del flujo', async () => {
      const mapeo = { Terminado: ['Hecho'], 'En curso': ['Hecho'] }
      expect(await estadoDe(mapeo, 'hecho')).toBe('En curso')
    })

    it('tolera un mapeo nulo o vacío', async () => {
      expect(await estadoDe({}, 'Entregado')).toBeNull()
      expect(await escalar(base, `select public._estado_desde_clickup(null, 'x', 'done')`)).toBe('Terminado')
    })
  })

  describe('importación de tareas', () => {
    it('una tarea Entregado con mapeo en lista llega como Terminado', async () => {
      await fijarMapeo(MAPEO_USUARIO)
      await aplicar(tarea({ status: { status: '☑ ENTREGADO', type: 'done' } }))
      expect(await estadoDelItem()).toBe('Terminado')
    })

    it('Listo para entregar llega como Terminado, en etapa de pruebas', async () => {
      await fijarMapeo(MAPEO_USUARIO)
      await aplicar(tarea({ status: { status: 'Listo para entregar', type: 'custom' } }))
      expect(await estadoDelItem()).toBe('Terminado, en etapa de pruebas')
    })

    it('un estado de tipo done fuera del mapeo llega como Terminado', async () => {
      await aplicar(tarea({ status: { status: 'Publicado', type: 'done' } }))
      expect(await estadoDelItem()).toBe('Terminado')
    })

    it('el mapeo de un tablero (con listas) reemplaza solo los estados que define', async () => {
      await base.query(`insert into public.clickup_tablero (nombre, mapeo_estados) values ('Analítica', $1::jsonb)`, [
        JSON.stringify({ 'En curso': ['Analizando', 'Modelando'] }),
      ])
      await base.query('update public.clickup_destino set tablero_id = 1')
      await aplicar(tarea({ status: { status: '🧪 Modelando', type: 'custom' } }))
      expect(await estadoDelItem()).toBe('En curso')
      await aplicar(tarea({ date_updated: ms(120), status: { status: 'entregado', type: 'custom' } }))
      expect(await estadoDelItem()).toBe('Terminado')
    })
  })

  describe('forma del mapeo', () => {
    it.each([
      ['un texto', { 'En curso': 'doing' }],
      ['una lista', { 'En curso': ['doing', 'wip'] }],
      ['una lista vacía', { 'En curso': [] }],
      ['un mapeo vacío', {}],
    ])('la configuración acepta %s', async (_, mapeo) => {
      await expect(fijarMapeo(mapeo)).resolves.toBeDefined()
    })

    it.each([
      ['un número', { 'En curso': 5 }],
      ['una lista con números', { 'En curso': ['a', 2] }],
      ['un objeto anidado', { 'En curso': { nombre: 'a' } }],
      ['un booleano', { 'En curso': true }],
      ['un nulo', { 'En curso': null }],
      ['un arreglo en lugar de objeto', ['a']],
      ['un texto suelto', 'a'],
    ])('la configuración rechaza %s', async (_, mapeo) => {
      await expect(fijarMapeo(mapeo)).rejects.toThrow(/clickup_config_mapeo_estados_ck/)
    })

    it('el mapeo de un tablero acepta listas, textos y nulo, y rechaza formas inválidas', async () => {
      await base.query(`insert into public.clickup_tablero (nombre, mapeo_estados) values ('A', '{"En curso":["a","b"]}'::jsonb)`)
      await base.query(`insert into public.clickup_tablero (nombre, mapeo_estados) values ('B', '{"En curso":"a"}'::jsonb)`)
      await base.query(`insert into public.clickup_tablero (nombre, mapeo_estados) values ('C', null)`)
      await expect(
        base.query(`insert into public.clickup_tablero (nombre, mapeo_estados) values ('D', '{"En curso":[1]}'::jsonb)`),
      ).rejects.toThrow(/clickup_tablero_mapeo_estados_ck/)
    })

    it('el mapeo por defecto sigue siendo válido y con los cinco estados', async () => {
      const mapeo = await escalar(base, 'select mapeo_estados from public.clickup_config')
      expect(Object.keys(mapeo).sort()).toEqual(['En curso', 'No iniciado', 'Suspendido', 'Terminado', 'Terminado, en etapa de pruebas'])
    })
  })

  describe('reconciliación forzada', () => {
    const LISTO = { status: 'Listo para entregar', type: 'custom' }

    const importar = async () => {
      await aplicar(tarea({ status: LISTO }))
      return escalar(base, 'select id::int from public.item where clickup_task_id = $1', ['T-1'])
    }

    it('sin forzar, un ítem con la sincronización al día no se actualiza aunque cambie el mapeo', async () => {
      const fecha = ms()
      await aplicar(tarea({ date_updated: fecha, status: LISTO }))
      expect(await estadoDelItem()).toBe('No iniciado')
      await fijarMapeo(MAPEO_USUARIO)
      const resultado = await aplicar(tarea({ date_updated: fecha, status: LISTO }), 'reconciliar')
      expect(resultado.resultado).toBe('ignorado')
      expect(await estadoDelItem()).toBe('No iniciado')
    })

    it('forzar aplica el estado de ClickUp sobre el ítem ya importado', async () => {
      const fecha = ms()
      await aplicar(tarea({ date_updated: fecha, status: LISTO }))
      await fijarMapeo(MAPEO_USUARIO)
      const resultado = await aplicarForzado(tarea({ date_updated: fecha, status: LISTO }))
      expect(resultado.resultado).toBe('actualizado')
      expect(await estadoDelItem()).toBe('Terminado, en etapa de pruebas')
    })

    it('forzar también sobrescribe aunque la tarea sea más antigua que la edición de la app', async () => {
      await importar()
      await fijarMapeo(MAPEO_USUARIO)
      const resultado = await aplicarForzado(tarea({ date_updated: ms(-7200), status: LISTO }))
      expect(resultado.resultado).toBe('actualizado')
      expect(await estadoDelItem()).toBe('Terminado, en etapa de pruebas')
    })

    it('forzar no encola un envío de vuelta a ClickUp', async () => {
      await importar()
      await base.query('delete from public.clickup_cola')
      await fijarMapeo(MAPEO_USUARIO)
      await aplicarForzado(tarea({ date_updated: ms(-7200), status: LISTO }))
      expect(await filas(base, 'select 1 from public.clickup_cola')).toEqual([])
    })

    it('forzar respeta el envío pendiente de la app para ese ítem', async () => {
      const id = await importar()
      await fijarMapeo(MAPEO_USUARIO)
      await base.query(`insert into public.clickup_cola (item_id, accion) values ($1, 'update')`, [id])
      const resultado = await aplicarForzado(tarea({ status: LISTO }))
      expect(resultado).toMatchObject({ resultado: 'ignorado', motivo: 'cambio de la app pendiente de envío' })
      expect(await estadoDelItem()).toBe('No iniciado')
    })

    it('forzar respeta los ítems eliminados en la app', async () => {
      const id = await importar()
      await fijarMapeo(MAPEO_USUARIO)
      await base.query('update public.item set eliminado_en = now() where id = $1', [id])
      const resultado = await aplicarForzado(tarea({ status: LISTO }))
      expect(resultado).toMatchObject({ resultado: 'ignorado', motivo: 'ítem eliminado en la app' })
    })

    it('forzar mantiene el archivado de tareas archivadas', async () => {
      const id = await importar()
      const resultado = await aplicarForzado(tarea({ archived: true }))
      expect(resultado).toMatchObject({ resultado: 'archivado', item_id: id })
      expect(await escalar(base, 'select eliminado_en is not null from public.item where id = $1', [id])).toBe(true)
    })

    it('forzar sigue ignorando tareas de listas sin destino', async () => {
      const resultado = await aplicarForzado(tarea({ id: 'T-9', list: { id: 'OTRA', name: 'Otra' } }))
      expect(resultado).toMatchObject({ resultado: 'ignorado', motivo: 'lista sin destino configurado' })
    })

    it('forzar crea los ítems nuevos igual que sin forzar', async () => {
      const resultado = await aplicarForzado(tarea({ id: 'T-7', status: { status: 'x', type: 'done' } }))
      expect(resultado.resultado).toBe('creado')
      expect(await estadoDelItem('T-7')).toBe('Terminado')
    })
  })

  describe('firma de aplicar_cambio_clickup', () => {
    it('queda una sola función, con el parámetro de forzar al final y por defecto en falso', async () => {
      const fila = await unaFila(
        base,
        `select count(*)::int as total, max(pg_get_function_arguments(oid)) as argumentos
           from pg_proc where proname = 'aplicar_cambio_clickup' and pronamespace = 'public'::regnamespace`,
      )
      expect(fila.total).toBe(1)
      expect(fila.argumentos).toMatch(/p_forzar boolean DEFAULT false$/)
    })

    it('la llamada con tres argumentos sigue funcionando', async () => {
      const resultado = await escalar(base, `select public.aplicar_cambio_clickup($1::jsonb, 'taskCreated', null)`, [JSON.stringify(tarea())])
      expect(resultado.resultado).toBe('creado')
    })

    it('la llamada solo con la tarea sigue funcionando', async () => {
      const resultado = await escalar(base, `select public.aplicar_cambio_clickup($1::jsonb)`, [JSON.stringify(tarea())])
      expect(resultado.resultado).toBe('creado')
    })

    it('solo service_role puede ejecutarla', async () => {
      for (const rol of ['authenticated', 'anon']) {
        await comoRol(base, rol, async () => {
          await expect(base.query(`select public.aplicar_cambio_clickup('{"id":"x"}'::jsonb, 'taskUpdated', null, true)`)).rejects.toThrow(
            /permission denied/,
          )
        })
      }
      await comoRol(base, 'service_role', async () => {
        await expect(
          base.query(`select public.aplicar_cambio_clickup('{"id":"x"}'::jsonb, 'taskDeleted', null, true)`),
        ).resolves.toBeDefined()
      })
    })
  })
})
