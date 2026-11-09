import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearBase, fechaRelativa, filas, guardarItem, ITEM_BASE, unaFila, escalar } from './helpers/baseDeDatos.js'

describe('guardar_item', () => {
  let base

  beforeEach(async () => {
    base = await crearBase()
  })
  afterEach(() => base.close())

  describe('alta', () => {
    it('asigna códigos BL-nnn consecutivos', async () => {
      const primero = await guardarItem(base, ITEM_BASE)
      const segundo = await guardarItem(base, { ...ITEM_BASE, funcionalidad: 'Otra' })
      expect([primero.codigo, segundo.codigo]).toEqual(['BL-001', 'BL-002'])
    })

    it('devuelve antes nulo, sin cambios y estado por defecto', async () => {
      const resultado = await guardarItem(base, ITEM_BASE)
      expect(resultado).toMatchObject({ antes: null, cambios: [], sin_cambios: false })
      const item = await unaFila(base, 'select estado, bloqueado from public.item where id = $1', [resultado.id])
      expect(item).toEqual({ estado: 'No iniciado', bloqueado: false })
    })

    it('crea los catálogos por nombre y los enlaza', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, producto: 'FieldOps' })
      const item = await unaFila(base, 'select * from public.v_item where id = $1', [id])
      expect(item).toMatchObject({
        producto: 'FieldOps',
        cliente: 'AIR-E',
        actividad: 'SCR',
        modulo: 'Torre de Control',
      })
    })

    it('no duplica catálogos al variar mayúsculas ni espacios', async () => {
      await guardarItem(base, ITEM_BASE)
      await guardarItem(base, { ...ITEM_BASE, funcionalidad: 'Otra', cliente: 'air-e', actividad: 'scr' })
      expect(await escalar(base, 'select count(*)::int from public.cliente')).toBe(1)
      expect(await escalar(base, 'select count(*)::int from public.actividad')).toBe(1)
    })

    it('asocia el módulo nuevo al producto indicado', async () => {
      await guardarItem(base, { ...ITEM_BASE, producto: 'Plataforma Nueva' })
      const modulo = await unaFila(
        base,
        `select p.nombre as producto from public.modulo m join public.producto p on p.id = m.producto_id`,
      )
      expect(modulo.producto).toBe('Plataforma Nueva')
    })

    it('normaliza los espacios de la funcionalidad', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, funcionalidad: '  Mapa   de   rutas  ' })
      expect(await escalar(base, 'select funcionalidad from public.item where id = $1', [id])).toBe('Mapa de rutas')
    })

    it('rechaza una funcionalidad vacía', async () => {
      await expect(guardarItem(base, { ...ITEM_BASE, funcionalidad: '   ' })).rejects.toThrow(
        'La funcionalidad es obligatoria',
      )
    })

    it('rechaza un estado inválido', async () => {
      await expect(guardarItem(base, { ...ITEM_BASE, estado: 'Inventado' })).rejects.toThrow()
    })

    it('registra la nota manual con su autor y tipo', async () => {
      const { id } = await guardarItem(base, ITEM_BASE, { nota: 'Primera nota', tipoNota: 'Planificación', autor: 'Vero' })
      const nota = await unaFila(base, 'select tipo, texto, autor from public.nota where item_id = $1', [id])
      expect(nota).toEqual({ tipo: 'Planificación', texto: 'Primera nota', autor: 'Vero' })
    })

    it('ignora el id enviado en los datos', async () => {
      const resultado = await guardarItem(base, { ...ITEM_BASE, id: 999 })
      expect(resultado.id).not.toBe(999)
    })
  })

  describe('actualización', () => {
    it('conserva los campos que no se envían', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, alcance: 'Mobile', descripcion: 'Detalle', estado: 'En curso' })
      await guardarItem(base, { fase: 'Desarrollo' }, { id })
      const item = await unaFila(base, 'select * from public.v_item where id = $1', [id])
      expect(item).toMatchObject({
        alcance: 'Mobile',
        descripcion: 'Detalle',
        estado: 'En curso',
        fase: 'Desarrollo',
        cliente: 'AIR-E',
      })
    })

    it('devuelve sin_cambios cuando no hay diferencias ni nota', async () => {
      const { id } = await guardarItem(base, ITEM_BASE)
      const resultado = await guardarItem(base, { alcance: 'Web' }, { id })
      expect(resultado.sin_cambios).toBe(true)
    })

    it('no escribe en la base cuando no hay cambios', async () => {
      const { id } = await guardarItem(base, ITEM_BASE)
      const antes = await escalar(base, 'select count(*)::int from public.auditoria')
      await guardarItem(base, {}, { id })
      expect(await escalar(base, 'select count(*)::int from public.auditoria')).toBe(antes)
    })

    it('guarda una nota aunque no haya cambios en el ítem', async () => {
      const { id } = await guardarItem(base, ITEM_BASE)
      const resultado = await guardarItem(base, {}, { id, nota: 'Solo una nota' })
      expect(resultado.sin_cambios).toBe(false)
      expect(await escalar(base, 'select count(*)::int from public.nota where item_id = $1', [id])).toBe(1)
    })

    it('devuelve el resumen de bloqueo anterior', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, bloqueado: true, motivo_bloqueo: 'Falta API' })
      const resultado = await guardarItem(base, { bloqueado: false }, { id })
      expect(resultado.antes).toEqual({ bloqueado: true, motivo_bloqueo: 'Falta API' })
    })

    it('falla si el ítem no existe', async () => {
      await expect(guardarItem(base, { alcance: 'Web' }, { id: 12345 })).rejects.toThrow('no existe')
    })

    it('no permite cambiar el código de un ítem existente', async () => {
      const { id, codigo } = await guardarItem(base, ITEM_BASE)
      await guardarItem(base, { codigo: 'BL-777', alcance: 'APK' }, { id })
      expect(await escalar(base, 'select codigo from public.item where id = $1', [id])).toBe(codigo)
    })

    it('no cambia el módulo si solo se actualiza otro campo', async () => {
      const { id } = await guardarItem(base, ITEM_BASE)
      await guardarItem(base, { estado: 'En curso' }, { id })
      expect(await escalar(base, 'select modulo from public.v_item where id = $1', [id])).toBe('Torre de Control')
    })
  })

  describe('terminado_en', () => {
    it('usa el fin real de pruebas al pasar a Terminado', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, real_fin: '2026-03-01', real_pruebas_fin: '2026-03-10' })
      await guardarItem(base, { estado: 'Terminado' }, { id })
      expect(await escalar(base, `select to_char(terminado_en, 'YYYY-MM-DD') from public.item where id = $1`, [id])).toBe('2026-03-10')
    })

    it('usa el fin real si no hay pruebas', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, real_fin: '2026-03-01' })
      await guardarItem(base, { estado: 'Terminado' }, { id })
      expect(await escalar(base, `select to_char(terminado_en, 'YYYY-MM-DD') from public.item where id = $1`, [id])).toBe('2026-03-01')
    })

    it('usa la fecha de hoy si no hay fechas reales', async () => {
      const { id } = await guardarItem(base, ITEM_BASE)
      await guardarItem(base, { estado: 'Terminado' }, { id })
      expect(await escalar(base, 'select terminado_en = public.hoy() from public.item where id = $1', [id])).toBe(true)
    })

    it('conserva la fecha original al editar un ítem ya terminado', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, real_fin: '2026-03-01' })
      await guardarItem(base, { estado: 'Terminado' }, { id })
      await guardarItem(base, { real_fin: '2026-04-15', descripcion: 'Editado' }, { id })
      expect(await escalar(base, `select to_char(terminado_en, 'YYYY-MM-DD') from public.item where id = $1`, [id])).toBe('2026-03-01')
    })

    it('limpia terminado_en al reabrir el ítem', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, estado: 'Terminado' })
      await guardarItem(base, { estado: 'En curso' }, { id })
      expect(await escalar(base, 'select terminado_en from public.item where id = $1', [id])).toBeNull()
    })
  })

  describe('reprogramaciones', () => {
    it('registra el texto exacto al cambiar una fecha planificada', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, plan_fin: '2026-01-10' })
      const resultado = await guardarItem(base, { plan_fin: '2026-02-10' }, { id })
      expect(resultado.cambios).toEqual([{ campo: 'plan_fin', antes: '2026-01-10', despues: '2026-02-10' }])
      const nota = await unaFila(base, `select tipo, texto, autor from public.nota where item_id = $1 and tipo = 'Reprogramación'`, [id])
      expect(nota).toEqual({
        tipo: 'Reprogramación',
        texto: 'Cambio de fechas · fin planificado: 10/01/2026 → 10/02/2026',
        autor: 'Automática',
      })
    })

    it('muestra un guion cuando la fecha anterior estaba vacía', async () => {
      const { id } = await guardarItem(base, ITEM_BASE)
      await guardarItem(base, { plan_ini: '2026-05-04' }, { id })
      const texto = await escalar(base, `select texto from public.nota where item_id = $1`, [id])
      expect(texto).toBe('Cambio de fechas · inicio planificado: - → 04/05/2026')
    })

    it('reúne varios cambios de fechas en una sola nota', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, plan_ini: '2026-01-01', plan_fin: '2026-01-31' })
      const resultado = await guardarItem(base, { plan_ini: '2026-02-01', plan_fin: '2026-02-28' }, { id })
      expect(resultado.cambios).toHaveLength(2)
      expect(await escalar(base, `select count(*)::int from public.nota where tipo = 'Reprogramación'`)).toBe(1)
      const texto = await escalar(base, `select texto from public.nota where tipo = 'Reprogramación'`)
      expect(texto).toBe(
        'Cambio de fechas · inicio planificado: 01/01/2026 → 01/02/2026; fin planificado: 31/01/2026 → 28/02/2026',
      )
    })

    it('usa la etiqueta de pruebas para las fechas de pruebas', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, plan_pruebas_fin: '2026-03-01' })
      await guardarItem(base, { plan_pruebas_fin: '2026-03-15' }, { id })
      const texto = await escalar(base, `select texto from public.nota where item_id = $1`, [id])
      expect(texto).toContain('fin de pruebas planificado: 01/03/2026 → 15/03/2026')
    })

    it('no registra reprogramación al cambiar fechas reales', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, real_ini: '2026-01-01' })
      const resultado = await guardarItem(base, { real_ini: '2026-01-05', real_fin: '2026-02-01' }, { id })
      expect(resultado.cambios).toEqual([])
      expect(await escalar(base, `select count(*)::int from public.nota where tipo = 'Reprogramación'`)).toBe(0)
    })

    it('no registra reprogramación en el alta', async () => {
      await guardarItem(base, { ...ITEM_BASE, plan_fin: '2026-01-10' })
      expect(await escalar(base, 'select count(*)::int from public.nota')).toBe(0)
    })
  })

  describe('bloqueo', () => {
    it('pone un motivo por defecto cuando se bloquea sin motivo', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, bloqueado: true })
      const item = await unaFila(base, 'select motivo_bloqueo from public.item where id = $1', [id])
      expect(item.motivo_bloqueo).toBe('Motivo pendiente: complétalo en el backlog')
    })

    it('vacía el motivo cuando el ítem no está bloqueado', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, bloqueado: false, motivo_bloqueo: 'Sobrante' })
      expect(await escalar(base, 'select motivo_bloqueo from public.item where id = $1', [id])).toBe('')
    })

    it('abre el bloqueante con severidad Media si no hay atraso', async () => {
      const futura = await fechaRelativa(base, 30)
      const { id } = await guardarItem(base, { ...ITEM_BASE, plan_fin: futura, bloqueado: true, motivo_bloqueo: 'Falta API' })
      const bloqueante = await unaFila(base, 'select severidad, motivo from public.bloqueante where item_id = $1', [id])
      expect(bloqueante).toEqual({ severidad: 'Media', motivo: 'Falta API' })
    })

    it('abre el bloqueante con severidad Alta si ya hay atraso', async () => {
      const pasada = await fechaRelativa(base, -10)
      const { id } = await guardarItem(base, { ...ITEM_BASE, plan_fin: pasada, estado: 'En curso', bloqueado: true, motivo_bloqueo: 'Falta API' })
      expect(await escalar(base, 'select severidad from public.bloqueante where item_id = $1', [id])).toBe('Alta')
    })

    it('agrega la nota de bloqueo automática', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, bloqueado: true, motivo_bloqueo: 'Falta API' })
      const nota = await unaFila(base, `select texto, autor from public.nota where item_id = $1 and tipo = 'Bloqueo'`, [id])
      expect(nota).toEqual({ texto: 'Bloqueado: Falta API', autor: 'Automática' })
    })

    it('actualiza el motivo del bloqueante abierto sin crear otro', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, bloqueado: true, motivo_bloqueo: 'Falta API' })
      await guardarItem(base, { motivo_bloqueo: 'Falta acceso al servidor' }, { id })
      const bloqueantes = await filas(base, 'select motivo, resuelto_en from public.bloqueante where item_id = $1', [id])
      expect(bloqueantes).toEqual([{ motivo: 'Falta acceso al servidor', resuelto_en: null }])
    })

    it('resuelve el bloqueante, anota y avisa al desbloquear', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, bloqueado: true, motivo_bloqueo: 'Falta API' })
      await guardarItem(base, { bloqueado: false }, { id })
      const bloqueante = await unaFila(base, 'select resuelto_en from public.bloqueante where item_id = $1', [id])
      expect(bloqueante.resuelto_en).not.toBeNull()
      const textos = (await filas(base, `select texto from public.nota where item_id = $1 and tipo = 'Bloqueo' order by id`, [id])).map((n) => n.texto)
      expect(textos).toEqual(['Bloqueado: Falta API', 'Bloqueo resuelto: Falta API'])
    })

    it('cancela solo los escalamientos pendientes del ítem al desbloquear', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, bloqueado: true, motivo_bloqueo: 'Falta API' })
      const otro = await guardarItem(base, { ...ITEM_BASE, funcionalidad: 'Otra' })
      const insertar = (regla, entidadId) =>
        base.query(
          `insert into public.alerta_programada (regla_codigo, entidad, entidad_id, asunto, cuerpo_html, destinatarios)
           values ($1, 'item', $2, 'x', '<p>x</p>', array['a@b.co'])`,
          [regla, entidadId],
        )
      await insertar('BLOQUEO_ESCALAR', id)
      await insertar('BLOQUEO_NUEVO', id)
      await insertar('BLOQUEO_ESCALAR', otro.id)
      await guardarItem(base, { bloqueado: false }, { id })
      const estados = await filas(base, 'select regla_codigo, entidad_id::int as entidad_id, estado from public.alerta_programada order by id')
      expect(estados).toEqual([
        { regla_codigo: 'BLOQUEO_ESCALAR', entidad_id: id, estado: 'Cancelada' },
        { regla_codigo: 'BLOQUEO_NUEVO', entidad_id: id, estado: 'Pendiente' },
        { regla_codigo: 'BLOQUEO_ESCALAR', entidad_id: otro.id, estado: 'Pendiente' },
      ])
    })

    it('impide dos bloqueantes abiertos para el mismo ítem', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, bloqueado: true, motivo_bloqueo: 'Falta API' })
      await expect(base.query(`insert into public.bloqueante (item_id, motivo) values ($1, 'Duplicado')`, [id])).rejects.toThrow()
    })

    it('permite volver a bloquear después de resolver', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, bloqueado: true, motivo_bloqueo: 'Primero' })
      await guardarItem(base, { bloqueado: false }, { id })
      await guardarItem(base, { bloqueado: true, motivo_bloqueo: 'Segundo' }, { id })
      expect(await escalar(base, 'select count(*)::int from public.bloqueante where item_id = $1', [id])).toBe(2)
      expect(await escalar(base, 'select count(*)::int from public.bloqueante where item_id = $1 and resuelto_en is null', [id])).toBe(1)
    })
  })
})
