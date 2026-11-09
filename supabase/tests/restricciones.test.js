import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearBase, crearCeremonia, escalar, guardarItem, ITEM_BASE } from './helpers/baseDeDatos.js'

describe('restricciones de las tablas', () => {
  let base

  beforeEach(async () => {
    base = await crearBase()
  })
  afterEach(() => base.close())

  const rechaza = (sql, parametros = []) => expect(base.query(sql, parametros)).rejects.toThrow()
  const acepta = (sql, parametros = []) => expect(base.query(sql, parametros)).resolves.toBeDefined()

  describe('item.estado', () => {
    it.each(['No iniciado', 'En curso', 'Terminado, en etapa de pruebas', 'Terminado', 'Suspendido'])(
      'acepta «%s»',
      async (estado) => {
        await expect(guardarItem(base, { ...ITEM_BASE, estado })).resolves.toBeDefined()
      },
    )

    it('rechaza un estado desconocido', async () => {
      await expect(guardarItem(base, { ...ITEM_BASE, estado: 'Hecho' })).rejects.toThrow()
    })
  })

  describe('persona.tipo', () => {
    it('acepta equipo y stakeholder', async () => {
      await acepta(`insert into public.persona (nombre, tipo) values ('A', 'equipo')`)
      await acepta(`insert into public.persona (nombre, tipo) values ('B', 'stakeholder')`)
    })

    it('rechaza otros tipos', () => rechaza(`insert into public.persona (nombre, tipo) values ('C', 'cliente')`))
  })

  describe('ceremonia.audiencia', () => {
    it.each(['equipo', 'stakeholders', 'todos'])('acepta «%s»', async (audiencia) => {
      await expect(crearCeremonia(base, { audiencia })).resolves.toBeDefined()
    })

    it('rechaza una audiencia desconocida', () => rechaza(`insert into public.ceremonia (tipo, titulo, fecha_hora, audiencia) values ('Demo', 'x', now(), 'todas')`))

    it('rechaza una duración no positiva', () => rechaza(`insert into public.ceremonia (tipo, titulo, fecha_hora, duracion_min) values ('Demo', 'x', now(), 0)`))
  })

  describe('regla_alerta.hora_envio', () => {
    it.each(['00:00', '08:30', '23:59'])('acepta «%s»', async (hora) => {
      await acepta(`update public.regla_alerta set hora_envio = $1 where codigo = 'VENCIMIENTO'`, [hora])
    })

    it.each(['24:00', '8:30', '12:60', 'abc', '08:30:00'])('rechaza «%s»', async (hora) => {
      await rechaza(`update public.regla_alerta set hora_envio = $1 where codigo = 'VENCIMIENTO'`, [hora])
    })
  })

  describe('bloqueante.severidad', () => {
    it('rechaza una severidad desconocida', async () => {
      const { id } = await guardarItem(base, ITEM_BASE)
      await rechaza(`insert into public.bloqueante (item_id, motivo, severidad) values ($1, 'x', 'Crítica')`, [id])
    })
  })

  describe('alerta_programada', () => {
    const insertar = (clave, estado = 'Pendiente') =>
      base.query(
        `insert into public.alerta_programada (regla_codigo, entidad, clave_unica, asunto, cuerpo_html, destinatarios, estado)
         values ('VENCIMIENTO', 'persona', $1, 'x', '<p>x</p>', array['a@b.co'], $2)`,
        [clave, estado],
      )

    it('rechaza un estado desconocido', () => expect(insertar('k1', 'Perdida')).rejects.toThrow())

    it('impide repetir la clave única', async () => {
      await insertar('VEN:1:2026-01-01')
      await expect(insertar('VEN:1:2026-01-01')).rejects.toThrow()
    })

    it('permite varias alertas sin clave única', async () => {
      await insertar(null)
      await insertar(null)
      expect(await escalar(base, 'select count(*)::int from public.alerta_programada')).toBe(2)
    })
  })

  describe('unicidad y claves', () => {
    it('impide dos clientes con el mismo nombre exacto', async () => {
      await acepta(`insert into public.cliente (nombre) values ('AIR-E')`)
      await rechaza(`insert into public.cliente (nombre) values ('AIR-E')`)
    })

    it('impide repetir el código de un ítem', async () => {
      await guardarItem(base, ITEM_BASE)
      const { id } = await guardarItem(base, { ...ITEM_BASE, funcionalidad: 'Otra' })
      await rechaza(`update public.item set codigo = 'BL-001' where id = $1`, [id])
    })

    it('impide una segunda fila en smtp_config', () => rechaza(`insert into public.smtp_config (id) values (false)`))

    it('rechaza una nota con un tipo desconocido', async () => {
      const { id } = await guardarItem(base, ITEM_BASE)
      await rechaza(`insert into public.nota (item_id, tipo, texto) values ($1, 'Otro', 'x')`, [id])
    })

    it('borrar un cliente deja el ítem sin cliente en vez de fallar', async () => {
      const { id } = await guardarItem(base, ITEM_BASE)
      await base.query('delete from public.cliente')
      expect(await escalar(base, 'select cliente_id from public.item where id = $1', [id])).toBeNull()
    })

    it('borrar un ítem arrastra sus notas y bloqueantes', async () => {
      const { id } = await guardarItem(base, { ...ITEM_BASE, bloqueado: true, motivo_bloqueo: 'x' }, { nota: 'n' })
      await base.query('delete from public.item where id = $1', [id])
      expect(await escalar(base, 'select count(*)::int from public.nota')).toBe(0)
      expect(await escalar(base, 'select count(*)::int from public.bloqueante')).toBe(0)
    })
  })
})
