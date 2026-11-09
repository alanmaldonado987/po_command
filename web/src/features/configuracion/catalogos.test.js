import { describe, expect, it } from 'vitest'
import { crearItem } from '../../test/fabricas'
import { aBorrador, aDatosCatalogo, BORRADOR_VACIO, contarUsos, mensajeDeError } from './catalogos'

describe('aBorrador', () => {
  it('sin registro devuelve el borrador vacío', () => {
    expect(aBorrador(null)).toBe(BORRADOR_VACIO)
  })

  it('completa descripción nula', () => {
    expect(aBorrador({ id: 1, nombre: 'SCR', descripcion: null }).descripcion).toBe('')
  })
})

describe('aDatosCatalogo', () => {
  const borrador = { nombre: '  AIR-E ', descripcion: 'x', estado: 'Pausado', producto_id: 3 }

  it('cliente incluye estado', () => {
    expect(aDatosCatalogo('cliente', borrador)).toEqual({ nombre: 'AIR-E', descripcion: 'x', estado: 'Pausado' })
  })

  it('módulo incluye producto', () => {
    expect(aDatosCatalogo('modulo', borrador)).toEqual({ nombre: 'AIR-E', descripcion: 'x', producto_id: 3 })
  })

  it('actividad no incluye extras', () => {
    expect(aDatosCatalogo('actividad', borrador)).toEqual({ nombre: 'AIR-E', descripcion: 'x' })
  })
})

describe('contarUsos', () => {
  it('cuenta ítems por id e ignora los nulos', () => {
    const items = [crearItem({ cliente_id: 1 }), crearItem({ cliente_id: 1 }), crearItem({ cliente_id: 2 }), crearItem({ cliente_id: null })]
    expect(contarUsos(items, 'cliente')).toEqual({ 1: 2, 2: 1 })
  })

  it('usa la columna de cada catálogo', () => {
    expect(contarUsos([crearItem({ modulo_id: 7 })], 'modulo')).toEqual({ 7: 1 })
  })
})

describe('mensajeDeError', () => {
  it('traduce el error de nombre duplicado', () => {
    expect(mensajeDeError(new Error('duplicate key value violates unique constraint'))).toBe('Ya existe un registro con ese nombre.')
  })

  it('deja pasar otros errores', () => {
    expect(mensajeDeError(new Error('permiso denegado'))).toBe('permiso denegado')
  })
})
