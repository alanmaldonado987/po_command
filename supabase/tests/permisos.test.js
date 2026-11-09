import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { comoRol, crearBase, escalar, guardarItem, insertarAlerta, ITEM_BASE } from './helpers/baseDeDatos.js'

const TABLAS_DE_NEGOCIO = [
  'config',
  'producto',
  'cliente',
  'actividad',
  'modulo',
  'persona',
  'persona_cliente',
  'item',
  'nota',
  'bloqueante',
  'ceremonia',
  'acuerdo',
  'regla_alerta',
]

describe('RLS y permisos', () => {
  let base

  beforeEach(async () => {
    base = await crearBase()
    await guardarItem(base, { ...ITEM_BASE, bloqueado: true, motivo_bloqueo: 'Falta API' }, { nota: 'n' })
    await insertarAlerta(base, { entidadId: 1 })
    await base.query(`insert into public.notificacion_log (estado) values ('Enviada')`)
  })
  afterEach(() => base.close())

  const contar = (rol, tabla) => comoRol(base, rol, () => escalar(base, `select count(*)::int from public.${tabla}`))

  describe('usuario autenticado', () => {
    it.each(TABLAS_DE_NEGOCIO)('lee la tabla %s', async (tabla) => {
      const total = await escalar(base, `select count(*)::int from public.${tabla}`)
      expect(await contar('authenticated', tabla)).toBe(total)
    })

    it('lee las vistas', async () => {
      expect(await contar('authenticated', 'v_item')).toBe(1)
      expect(await contar('authenticated', 'v_bloqueante_abierto')).toBe(1)
      expect(await contar('authenticated', 'v_persona')).toBe(0)
    })

    it('puede guardar un ítem con la función guardar_item', async () => {
      const resultado = await comoRol(base, 'authenticated', () =>
        guardarItem(base, { ...ITEM_BASE, funcionalidad: 'Desde la app' }),
      )
      expect(resultado.codigo).toBe('BL-002')
    })

    it('puede escribir en las tablas de negocio', async () => {
      await comoRol(base, 'authenticated', () => base.query(`insert into public.cliente (nombre) values ('Nuevo')`))
      expect(await escalar(base, `select count(*)::int from public.cliente where nombre = 'Nuevo'`)).toBe(1)
    })

    it('puede leer y actualizar la cola de alertas', async () => {
      expect(await contar('authenticated', 'alerta_programada')).toBe(1)
      await comoRol(base, 'authenticated', () => base.query(`update public.alerta_programada set estado = 'Cancelada'`))
      expect(await escalar(base, `select estado from public.alerta_programada`)).toBe('Cancelada')
    })

    it('puede leer el historial y la auditoría', async () => {
      expect(await contar('authenticated', 'notificacion_log')).toBe(1)
      expect(await contar('authenticated', 'auditoria')).toBeGreaterThan(0)
    })

    it('no ve ninguna fila de smtp_config', async () => {
      expect(await contar('authenticated', 'smtp_config')).toBe(0)
    })

    it('no puede modificar smtp_config', async () => {
      await comoRol(base, 'authenticated', () => base.query(`update public.smtp_config set password = 'robada'`))
      expect(await escalar(base, 'select password from public.smtp_config')).toBe('')
    })

    it('no puede insertar en smtp_config', async () => {
      await base.query('delete from public.smtp_config')
      await comoRol(base, 'authenticated', async () => {
        await expect(base.query(`insert into public.smtp_config (id, host) values (true, 'x')`)).rejects.toThrow(
          /row-level security/,
        )
      })
    })

    it('no puede escribir directamente en auditoria', async () => {
      await comoRol(base, 'authenticated', async () => {
        await expect(base.query(`insert into public.auditoria (entidad, accion) values ('x', 'y')`)).rejects.toThrow()
      })
    })

    it('no puede borrar ni editar la auditoría', async () => {
      const antes = await escalar(base, 'select count(*)::int from public.auditoria')
      await comoRol(base, 'authenticated', async () => {
        await base.query('delete from public.auditoria')
        await base.query(`update public.auditoria set detalle = 'manipulado'`)
      })
      expect(await escalar(base, 'select count(*)::int from public.auditoria')).toBe(antes)
      expect(await escalar(base, `select count(*)::int from public.auditoria where detalle = 'manipulado'`)).toBe(0)
    })

    it('no puede escribir en notificacion_log', async () => {
      await comoRol(base, 'authenticated', async () => {
        await expect(base.query(`insert into public.notificacion_log (estado) values ('Enviada')`)).rejects.toThrow()
      })
    })

    it('no puede insertar en alerta_programada directamente', async () => {
      await comoRol(base, 'authenticated', async () => {
        await expect(insertarAlerta(base)).rejects.toThrow()
      })
    })
  })

  describe('usuario anónimo', () => {
    it.each([...TABLAS_DE_NEGOCIO, 'alerta_programada', 'notificacion_log', 'auditoria', 'smtp_config'])(
      'no ve filas de %s',
      async (tabla) => {
        expect(await contar('anon', tabla)).toBe(0)
      },
    )

    it('no ve las vistas', async () => {
      expect(await contar('anon', 'v_item')).toBe(0)
      expect(await contar('anon', 'v_bloqueante_abierto')).toBe(0)
    })

    it('no puede guardar ítems', async () => {
      await comoRol(base, 'anon', async () => {
        await expect(guardarItem(base, ITEM_BASE)).rejects.toThrow()
      })
    })

    it('no puede importar un plan', async () => {
      await comoRol(base, 'anon', async () => {
        await expect(base.query(`select public.importar_plan('[]'::jsonb, false)`)).rejects.toThrow()
      })
    })

    it('no puede escribir en la tabla de auditoría llamando a registrar_auditoria', async () => {
      await comoRol(base, 'anon', async () => {
        await expect(base.query(`select public.registrar_auditoria('spam', null, 'x', 'x')`)).rejects.toThrow()
      })
    })
  })

  describe('service_role', () => {
    it('lee smtp_config y escribe en notificacion_log', async () => {
      expect(await contar('service_role', 'smtp_config')).toBe(1)
      await comoRol(base, 'service_role', () => base.query(`insert into public.notificacion_log (estado) values ('Enviada')`))
      expect(await escalar(base, 'select count(*)::int from public.notificacion_log')).toBe(2)
    })
  })
})
