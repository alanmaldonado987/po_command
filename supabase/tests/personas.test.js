import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearBase, escalar, filas, guardarItem, ITEM_BASE, unaFila } from './helpers/baseDeDatos.js'

const guardarPersona = (base, datos, clientes = [], id = null) =>
  escalar(base, 'select public.guardar_persona($1::jsonb, $2::bigint[], $3)', [JSON.stringify(datos), clientes, id])

const PERSONA = { nombre: 'Ana Gómez', correo: 'ana@ises.com.co', tipo: 'stakeholder', rol: 'Gerente' }

describe('guardar_persona', () => {
  let base

  beforeEach(async () => {
    base = await crearBase()
    await base.query(`insert into public.cliente (nombre) values ('AIR-E'), ('AFINIA')`)
  })
  afterEach(() => base.close())

  it('crea una persona con valores por defecto', async () => {
    const id = await guardarPersona(base, PERSONA)
    const persona = await unaFila(base, 'select * from public.persona where id = $1', [id])
    expect(persona).toMatchObject({
      nombre: 'Ana Gómez',
      correo: 'ana@ises.com.co',
      tipo: 'stakeholder',
      rol: 'Gerente',
      frecuencia_reporte: '',
      recibe: [],
      activo: true,
    })
  })

  it('guarda las categorías que recibe como arreglo de texto', async () => {
    const id = await guardarPersona(base, { ...PERSONA, recibe: ['Bloqueantes', 'Ceremonias'] })
    expect(await escalar(base, 'select recibe from public.persona where id = $1', [id])).toEqual(['Bloqueantes', 'Ceremonias'])
  })

  it('normaliza espacios del nombre y recorta el correo', async () => {
    const id = await guardarPersona(base, { ...PERSONA, nombre: '  Ana    Gómez ', correo: '  ana@ises.com.co ' })
    const persona = await unaFila(base, 'select nombre, correo from public.persona where id = $1', [id])
    expect(persona).toEqual({ nombre: 'Ana Gómez', correo: 'ana@ises.com.co' })
  })

  it('respeta activo=false', async () => {
    const id = await guardarPersona(base, { ...PERSONA, activo: false })
    expect(await escalar(base, 'select activo from public.persona where id = $1', [id])).toBe(false)
  })

  it('asocia los clientes indicados', async () => {
    const clientes = (await filas(base, 'select id::int from public.cliente order by id')).map((c) => c.id)
    const id = await guardarPersona(base, PERSONA, clientes)
    expect(await escalar(base, 'select count(*)::int from public.persona_cliente where persona_id = $1', [id])).toBe(2)
  })

  it('edita una persona existente sin duplicarla', async () => {
    const id = await guardarPersona(base, PERSONA)
    const mismo = await guardarPersona(base, { ...PERSONA, rol: 'Director' }, [], id)
    expect(mismo).toBe(id)
    expect(await escalar(base, 'select count(*)::int from public.persona')).toBe(1)
    expect(await escalar(base, 'select rol from public.persona where id = $1', [id])).toBe('Director')
  })

  it('reemplaza la lista de clientes al editar', async () => {
    const [primero, segundo] = (await filas(base, 'select id::int from public.cliente order by id')).map((c) => c.id)
    const id = await guardarPersona(base, PERSONA, [primero])
    await guardarPersona(base, PERSONA, [segundo], id)
    const clientes = (await filas(base, 'select cliente_id::int as id from public.persona_cliente where persona_id = $1', [id])).map((c) => c.id)
    expect(clientes).toEqual([segundo])
  })

  it('deja a la persona sin clientes cuando se envía una lista vacía', async () => {
    const [primero] = (await filas(base, 'select id::int from public.cliente')).map((c) => c.id)
    const id = await guardarPersona(base, PERSONA, [primero])
    await guardarPersona(base, PERSONA, [], id)
    expect(await escalar(base, 'select count(*)::int from public.persona_cliente')).toBe(0)
  })

  it('rechaza un nombre vacío', async () => {
    await expect(guardarPersona(base, { ...PERSONA, nombre: '   ' })).rejects.toThrow('El nombre es obligatorio')
  })

  it('rechaza un tipo inválido', async () => {
    await expect(guardarPersona(base, { ...PERSONA, tipo: 'externo' })).rejects.toThrow()
  })

  it('al borrar la persona deja sus ítems sin responsable', async () => {
    const id = await guardarPersona(base, { ...PERSONA, tipo: 'equipo' })
    const item = await guardarItem(base, { ...ITEM_BASE, responsable_id: id })
    await base.query('delete from public.persona where id = $1', [id])
    expect(await escalar(base, 'select responsable_id from public.item where id = $1', [item.id])).toBeNull()
  })
})
