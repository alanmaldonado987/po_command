import { describe, expect, it } from 'vitest'
import { describirHerencia, destinoPropio, ORIGEN_DESTINO, resolverDestino, usoDeTablero } from './destinos'

const destino = (id, tablero_id, cliente_id, lista_nombre = `Lista ${id}`) => ({
  id,
  tablero_id,
  cliente_id,
  lista_id: `l${id}`,
  lista_nombre,
})

const TODOS = [destino(1, null, null), destino(2, null, 10), destino(3, 5, null), destino(4, 5, 10)]

describe('resolverDestino', () => {
  it('prefiere el destino del tablero y cliente exactos', () => {
    expect(resolverDestino(TODOS, 5, 10)).toEqual({ destino: TODOS[3], origen: ORIGEN_DESTINO.propio })
  })

  it('sin destino de tablero y cliente usa el del tablero para todos los clientes', () => {
    expect(resolverDestino(TODOS.slice(0, 3), 5, 10)).toEqual({ destino: TODOS[2], origen: ORIGEN_DESTINO.tablero })
  })

  it('sin destinos del tablero usa el del cliente sin tablero', () => {
    expect(resolverDestino([TODOS[0], TODOS[1]], 5, 10)).toEqual({ destino: TODOS[1], origen: ORIGEN_DESTINO.cliente })
  })

  it('al final usa el destino por defecto global', () => {
    expect(resolverDestino([TODOS[0]], 5, 10)).toEqual({ destino: TODOS[0], origen: ORIGEN_DESTINO.defecto })
  })

  it('sin ninguno devuelve null', () => {
    expect(resolverDestino([], 5, 10)).toEqual({ destino: null, origen: null })
  })

  it('un ítem sin tablero ignora los destinos de los tableros', () => {
    expect(resolverDestino([TODOS[2], TODOS[3]], null, 10)).toEqual({ destino: null, origen: null })
    expect(resolverDestino(TODOS, null, 10)).toEqual({ destino: TODOS[1], origen: ORIGEN_DESTINO.propio })
  })

  it('un ítem sin cliente usa el destino del tablero o el global', () => {
    expect(resolverDestino(TODOS, 5, null)).toEqual({ destino: TODOS[2], origen: ORIGEN_DESTINO.propio })
    expect(resolverDestino(TODOS, 6, null)).toEqual({ destino: TODOS[0], origen: ORIGEN_DESTINO.defecto })
  })

  it('la fila raíz (sin tablero ni cliente) es el destino por defecto propio', () => {
    expect(resolverDestino(TODOS, null, null)).toEqual({ destino: TODOS[0], origen: ORIGEN_DESTINO.propio })
  })

  it('trata undefined como null', () => {
    expect(resolverDestino(TODOS, undefined, undefined).destino).toBe(TODOS[0])
  })
})

describe('destinoPropio', () => {
  it('solo devuelve la coincidencia exacta', () => {
    expect(destinoPropio(TODOS, 5, 10)).toBe(TODOS[3])
    expect(destinoPropio(TODOS, 5, 99)).toBeNull()
    expect(destinoPropio(TODOS, null, null)).toBe(TODOS[0])
    expect(destinoPropio(TODOS, undefined, 10)).toBe(TODOS[1])
  })
})

describe('describirHerencia', () => {
  it('sin destino avisa en rojo', () => {
    expect(describirHerencia({ destino: null, origen: null })).toEqual({ tono: 'rojo', texto: 'Sin destino' })
  })

  it('con destino propio no avisa', () => {
    expect(describirHerencia({ destino: TODOS[3], origen: ORIGEN_DESTINO.propio })).toBeNull()
  })

  it.each([
    [ORIGEN_DESTINO.tablero, 'Usa el destino del tablero'],
    [ORIGEN_DESTINO.cliente, 'Usa el destino del cliente'],
    [ORIGEN_DESTINO.defecto, 'Usa el destino por defecto'],
  ])('indica de dónde hereda (%s)', (origen, texto) => {
    expect(describirHerencia({ destino: TODOS[0], origen })).toEqual({ tono: 'azul', texto })
  })
})

describe('usoDeTablero', () => {
  it('cuenta las personas y los destinos de un tablero', () => {
    const personas = [{ tablero_id: 5 }, { tablero_id: 5 }, { tablero_id: 6 }, { tablero_id: null }]
    expect(usoDeTablero(5, personas, TODOS)).toEqual({ personas: 2, destinos: 2 })
    expect(usoDeTablero(7, personas, TODOS)).toEqual({ personas: 0, destinos: 0 })
  })
})
