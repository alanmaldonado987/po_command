import { beforeEach, describe, expect, it, vi } from 'vitest'
import { constructorFalso } from '../test/constructorFalso'

const { cliente } = vi.hoisted(() => ({ cliente: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } } }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => cliente }))

const catalogos = await import('./catalogos')
const personas = await import('./personas')
const ceremonias = await import('./ceremonias')

beforeEach(() => vi.clearAllMocks())

function usarConstructor(resultado) {
  const falso = constructorFalso(resultado ?? { data: [], error: null })
  cliente.from.mockReturnValue(falso.constructor)
  cliente.rpc.mockReturnValue(falso.constructor)
  return falso
}

describe('api/catalogos', () => {
  it.each([
    ['cliente', 'estado'],
    ['actividad', 'descripcion'],
    ['modulo', 'producto_id'],
    ['producto', 'estado'],
  ])('listarCatalogo(%s) selecciona los campos propios y ordena por nombre', async (tabla, campo) => {
    const falso = usarConstructor()
    await catalogos.listarCatalogo(tabla)
    expect(cliente.from).toHaveBeenCalledWith(tabla)
    expect(falso.llamada('select')[0]).toContain(campo)
    expect(falso.llamada('order')).toEqual(['nombre'])
  })

  it('crearRegistro inserta y devuelve la fila', async () => {
    const falso = usarConstructor({ data: { id: 1 }, error: null })
    await expect(catalogos.crearRegistro('cliente', { nombre: 'X' })).resolves.toEqual({ id: 1 })
    expect(falso.llamada('insert')).toEqual([{ nombre: 'X' }])
    expect(falso.llamada('single')).toBeDefined()
  })

  it('actualizarRegistro filtra por id', async () => {
    const falso = usarConstructor({ data: {}, error: null })
    await catalogos.actualizarRegistro('modulo', 3, { nombre: 'Y' })
    expect(falso.llamada('update')).toEqual([{ nombre: 'Y' }])
    expect(falso.llamada('eq')).toEqual(['id', 3])
  })

  it('eliminarRegistro borra por id', async () => {
    const falso = usarConstructor({ data: null, error: null })
    await catalogos.eliminarRegistro('actividad', 8)
    expect(falso.llamada('delete')).toBeDefined()
    expect(falso.llamada('eq')).toEqual(['id', 8])
  })

  it('un nombre duplicado propaga el error de la base', async () => {
    usarConstructor({ data: null, error: { message: 'duplicate key value violates unique constraint' } })
    await expect(catalogos.crearRegistro('cliente', { nombre: 'AIR-E' })).rejects.toThrow(/duplicate key/)
  })
})

describe('api/personas', () => {
  it('listarPersonas lee v_persona por nombre', async () => {
    const falso = usarConstructor()
    await personas.listarPersonas()
    expect(cliente.from).toHaveBeenCalledWith('v_persona')
    expect(falso.llamada('order')).toEqual(['nombre'])
  })

  it('guardarPersona llama a la RPC con clientes e id', async () => {
    usarConstructor({ data: 12, error: null })
    await expect(personas.guardarPersona({ datos: { nombre: 'Ana' }, clienteIds: [1, 2], id: 12 })).resolves.toBe(12)
    expect(cliente.rpc).toHaveBeenCalledWith('guardar_persona', { p_data: { nombre: 'Ana' }, p_clientes: [1, 2], p_id: 12 })
  })

  it('guardarPersona sin id crea', async () => {
    usarConstructor({ data: 1, error: null })
    await personas.guardarPersona({ datos: {}, clienteIds: [] })
    expect(cliente.rpc).toHaveBeenCalledWith('guardar_persona', { p_data: {}, p_clientes: [], p_id: null })
  })

  it('eliminarPersona borra por id', async () => {
    const falso = usarConstructor({ data: null, error: null })
    await personas.eliminarPersona(5)
    expect(cliente.from).toHaveBeenCalledWith('persona')
    expect(falso.llamada('eq')).toEqual(['id', 5])
  })
})

describe('api/ceremonias', () => {
  it('listarCeremonias ordena por fecha y hora', async () => {
    const falso = usarConstructor()
    await ceremonias.listarCeremonias()
    expect(cliente.from).toHaveBeenCalledWith('v_ceremonia')
    expect(falso.llamada('order')).toEqual(['fecha_hora'])
  })

  it('guardarCeremonia inserta cuando no hay id y actualiza cuando sí', async () => {
    const nueva = usarConstructor({ data: { id: 1 }, error: null })
    await ceremonias.guardarCeremonia({ datos: { titulo: 'A' } })
    expect(nueva.llamada('insert')).toEqual([{ titulo: 'A' }])
    const existente = usarConstructor({ data: { id: 2 }, error: null })
    await ceremonias.guardarCeremonia({ datos: { titulo: 'B' }, id: 2 })
    expect(existente.llamada('update')).toEqual([{ titulo: 'B' }])
    expect(existente.llamada('eq')).toEqual(['id', 2])
  })

  it('eliminarCeremonia usa la RPC que cancela alertas', async () => {
    usarConstructor({ data: 2, error: null })
    await expect(ceremonias.eliminarCeremonia(4)).resolves.toBe(2)
    expect(cliente.rpc).toHaveBeenCalledWith('eliminar_ceremonia', { p_id: 4 })
  })

  it('listarAcuerdos ordena por fecha límite con nulos al final', async () => {
    const falso = usarConstructor()
    await ceremonias.listarAcuerdos()
    expect(falso.llamada('order')).toEqual(['fecha_limite', { nullsFirst: false }])
  })

  it('guardarAcuerdo y eliminarAcuerdo', async () => {
    const falso = usarConstructor({ data: { id: 1 }, error: null })
    await ceremonias.guardarAcuerdo({ datos: { descripcion: 'x' } })
    expect(falso.llamada('insert')).toEqual([{ descripcion: 'x' }])
    await ceremonias.guardarAcuerdo({ datos: { descripcion: 'y' }, id: 6 })
    expect(falso.llamada('update')).toEqual([{ descripcion: 'y' }])
    await ceremonias.eliminarAcuerdo(6)
    expect(falso.llamada('delete')).toBeDefined()
  })
})
