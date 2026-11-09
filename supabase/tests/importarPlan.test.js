import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearBase, escalar, filas, guardarItem, unaFila } from './helpers/baseDeDatos.js'

const FILA = {
  clave: 'air-e|scr|torre de control|completo|desarrollo|web',
  cliente: 'AIR-E',
  actividad: 'SCR',
  modulo: 'Torre de Control',
  funcionalidad: 'Completo',
  fase: 'Desarrollo',
  alcance: 'Web',
  responsable: 'Dairo Pérez',
  producto: '',
  estado: 'En curso',
  estado_deducido: false,
  plan_ini: '2026-01-05',
  plan_fin: '2026-01-31',
  plan_pruebas_ini: null,
  plan_pruebas_fin: null,
  real_ini: null,
  real_fin: null,
  real_pruebas_ini: null,
  real_pruebas_fin: null,
  consid_plan: [],
  consid_real: [],
}

describe('importar_plan', () => {
  let base

  const importar = (lista, simular = false) =>
    escalar(base, 'select public.importar_plan($1::jsonb, $2)', [JSON.stringify(lista), simular])

  beforeEach(async () => {
    base = await crearBase()
  })
  afterEach(() => base.close())

  describe('simulación', () => {
    it('cuenta sin escribir nada', async () => {
      const resultado = await importar([FILA], true)
      expect(resultado).toMatchObject({ filas: 1, nuevos: 1, actualizados: 0 })
      expect(await escalar(base, 'select count(*)::int from public.item')).toBe(0)
      expect(await escalar(base, 'select count(*)::int from public.persona')).toBe(0)
      expect(await escalar(base, `select count(*)::int from public.auditoria where entidad = 'importacion'`)).toBe(0)
    })

    it('anuncia las personas nuevas sin crearlas', async () => {
      const resultado = await importar([FILA], true)
      expect(resultado.personas_nuevas).toEqual(['Dairo Pérez'])
    })

    it('cuenta como actualizados los ítems que ya existen', async () => {
      await importar([FILA])
      const resultado = await importar([FILA], true)
      expect(resultado).toMatchObject({ nuevos: 0, actualizados: 1 })
    })
  })

  describe('importación real', () => {
    it('crea el ítem con catálogos, fechas y clave de importación', async () => {
      const resultado = await importar([FILA])
      expect(resultado).toMatchObject({ nuevos: 1, actualizados: 0, sin_cambios: 0 })
      const item = await unaFila(base, 'select * from public.v_item')
      expect(item).toMatchObject({
        cliente: 'AIR-E',
        actividad: 'SCR',
        modulo: 'Torre de Control',
        fase: 'Desarrollo',
        alcance: 'Web',
        estado: 'En curso',
        responsable: 'Dairo Pérez',
        clave_importacion: FILA.clave,
      })
    })

    it('usa FieldOps como producto por defecto', async () => {
      await importar([FILA])
      expect(await escalar(base, 'select producto from public.v_item')).toBe('FieldOps')
      expect(await escalar(base, 'select count(*)::int from public.producto')).toBe(1)
    })

    it('respeta el producto cuando el Excel lo trae', async () => {
      await importar([{ ...FILA, producto: 'Otro Producto' }])
      expect(await escalar(base, 'select producto from public.v_item')).toBe('Otro Producto')
    })

    it('crea al responsable nuevo con rol Developer y categorías por defecto', async () => {
      await importar([FILA])
      const persona = await unaFila(base, 'select tipo, rol, recibe, correo from public.persona')
      expect(persona).toEqual({
        tipo: 'equipo',
        rol: 'Developer',
        recibe: ['Bloqueantes', 'Vencimientos', 'Reprogramaciones', 'Ceremonias'],
        correo: '',
      })
    })

    it('reutiliza al responsable existente sin importar tildes ni mayúsculas', async () => {
      await base.query(`insert into public.persona (nombre, tipo) values ('DAIRO PEREZ', 'equipo')`)
      const resultado = await importar([FILA])
      expect(resultado.personas_nuevas).toEqual([])
      expect(await escalar(base, 'select count(*)::int from public.persona')).toBe(1)
    })

    it('deja el ítem sin responsable cuando la fila no lo trae', async () => {
      await importar([{ ...FILA, responsable: '' }])
      expect(await escalar(base, 'select responsable_id from public.item')).toBeNull()
    })

    it('importa varias filas y las cuenta', async () => {
      const resultado = await importar([FILA, { ...FILA, clave: 'otra', funcionalidad: 'Mapa' }])
      expect(resultado).toMatchObject({ filas: 2, nuevos: 2 })
      expect(await escalar(base, 'select count(*)::int from public.item')).toBe(2)
    })

    it('registra la importación en la auditoría', async () => {
      await importar([FILA])
      const registro = await unaFila(base, `select accion, detalle from public.auditoria where entidad = 'importacion'`)
      expect(registro).toEqual({ accion: 'importar', detalle: '1 nuevos, 0 actualizados, 0 notas' })
    })
  })

  describe('idempotencia y actualización', () => {
    it('la segunda corrida con los mismos datos da sin_cambios', async () => {
      await importar([FILA])
      const resultado = await importar([FILA])
      expect(resultado).toMatchObject({ nuevos: 0, actualizados: 0, sin_cambios: 1, notas: 0, reprogramaciones: 0 })
      expect(await escalar(base, 'select count(*)::int from public.item')).toBe(1)
    })

    it('actualiza el ítem y cuenta la reprogramación al cambiar una fecha planificada', async () => {
      await importar([FILA])
      const resultado = await importar([{ ...FILA, plan_fin: '2026-02-28' }])
      expect(resultado).toMatchObject({ nuevos: 0, actualizados: 1, reprogramaciones: 1 })
      const texto = await escalar(base, `select texto from public.nota where tipo = 'Reprogramación'`)
      expect(texto).toBe('Cambio de fechas · fin planificado: 31/01/2026 → 28/02/2026')
    })

    it('cuenta como actualizado, no como reprogramación, un cambio de estado', async () => {
      await importar([FILA])
      const resultado = await importar([{ ...FILA, estado: 'Terminado' }])
      expect(resultado).toMatchObject({ actualizados: 1, reprogramaciones: 0 })
    })

    it('no pisa el estado existente cuando el estado fue deducido', async () => {
      await importar([FILA])
      await importar([{ ...FILA, estado: 'No iniciado', estado_deducido: true }])
      expect(await escalar(base, 'select estado from public.item')).toBe('En curso')
    })

    it('aplica el estado deducido a un ítem nuevo', async () => {
      await importar([{ ...FILA, estado: 'No iniciado', estado_deducido: true }])
      expect(await escalar(base, 'select estado from public.item')).toBe('No iniciado')
    })

    it('preserva la descripción y el bloqueo registrados en la app', async () => {
      await importar([FILA])
      const id = await escalar(base, 'select id::int from public.item')
      await guardarItem(base, { descripcion: 'Notas de la app', bloqueado: true, motivo_bloqueo: 'Falta API' }, { id })
      await importar([{ ...FILA, plan_fin: '2026-03-31' }])
      const item = await unaFila(base, 'select descripcion, bloqueado, motivo_bloqueo from public.item where id = $1', [id])
      expect(item).toEqual({ descripcion: 'Notas de la app', bloqueado: true, motivo_bloqueo: 'Falta API' })
    })

    it('conserva el producto del ítem existente cuando el Excel no lo trae', async () => {
      await importar([{ ...FILA, producto: 'Otro Producto' }])
      await importar([{ ...FILA, plan_fin: '2026-03-31', producto: '' }])
      expect(await escalar(base, 'select producto from public.v_item')).toBe('Otro Producto')
    })

    it('limpia una fecha cuando el Excel la deja vacía', async () => {
      await importar([FILA])
      await importar([{ ...FILA, plan_ini: null }])
      expect(await escalar(base, 'select plan_ini from public.item')).toBeNull()
    })
  })

  describe('notas de consideraciones', () => {
    it('crea las notas con su fecha, tipo y autor Importación', async () => {
      const resultado = await importar([
        {
          ...FILA,
          consid_plan: [{ texto: '25AGO: arranca el desarrollo', fecha: '2026-08-25' }],
          consid_real: [{ texto: 'Avance 50%', fecha: null }],
        },
      ])
      expect(resultado.notas).toBe(2)
      const lista = await filas(base, `select tipo, texto, to_char(fecha, 'YYYY-MM-DD') as fecha, autor from public.nota order by id`)
      expect(lista[0]).toEqual({ tipo: 'Planificación', texto: '25AGO: arranca el desarrollo', fecha: '2026-08-25', autor: 'Importación' })
      expect(lista[1]).toMatchObject({ tipo: 'Ejecución', texto: 'Avance 50%', autor: 'Importación' })
    })

    it('usa la fecha de hoy cuando la nota no trae fecha', async () => {
      await importar([{ ...FILA, consid_real: [{ texto: 'Sin fecha', fecha: null }] }])
      expect(await escalar(base, 'select fecha = public.hoy() from public.nota')).toBe(true)
    })

    it('no repite notas al reimportar', async () => {
      const fila = { ...FILA, consid_plan: [{ texto: 'Nota única', fecha: '2026-01-02' }] }
      await importar([fila])
      const segunda = await importar([fila])
      expect(segunda.notas).toBe(0)
      expect(await escalar(base, 'select count(*)::int from public.nota')).toBe(1)
    })

    it('detecta duplicados aunque cambien tildes, mayúsculas y espacios', async () => {
      await importar([{ ...FILA, consid_plan: [{ texto: 'Revisión   pendiente', fecha: '2026-01-02' }] }])
      const resultado = await importar([{ ...FILA, consid_plan: [{ texto: 'revision pendiente ', fecha: '2026-01-02' }] }])
      expect(resultado.notas).toBe(0)
    })

    it('agrega solo las notas nuevas', async () => {
      await importar([{ ...FILA, consid_plan: [{ texto: 'Primera', fecha: '2026-01-02' }] }])
      const resultado = await importar([
        { ...FILA, consid_plan: [{ texto: 'Primera', fecha: '2026-01-02' }, { texto: 'Segunda', fecha: '2026-01-09' }] },
      ])
      expect(resultado.notas).toBe(1)
    })
  })
})
