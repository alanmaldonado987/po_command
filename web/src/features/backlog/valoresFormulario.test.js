import { describe, expect, it } from 'vitest'
import { crearItem } from '../../test/fabricas'
import { aDatosItem, validar, valoresDeItem, valoresIniciales } from './valoresFormulario'

const validos = () => ({
  ...valoresIniciales(),
  cliente: 'AIR-E',
  actividad: 'SCR',
  modulo: 'Órdenes',
  funcionalidad: 'Completo',
  alcance: 'Web',
})

describe('valoresIniciales', () => {
  it('sin base propone FieldOps, Desarrollo y No iniciado', () => {
    expect(valoresIniciales()).toMatchObject({
      producto: 'FieldOps',
      fase: 'Desarrollo',
      estado: 'No iniciado',
      bloqueado: false,
      plan_fin: null,
    })
  })

  it('con base copia los datos pero reinicia nota y bloqueo', () => {
    const base = crearItem({ cliente: 'AFINIA', bloqueado: true, motivo_bloqueo: 'x', plan_fin: '2026-01-01' })
    const valores = valoresIniciales(base)
    expect(valores.cliente).toBe('AFINIA')
    expect(valores.plan_fin).toBe('2026-01-01')
    expect(valores.bloqueado).toBe(false)
    expect(valores.nota).toBe('')
  })
})

describe('prioridad', () => {
  it('sin base arranca sin prioridad y se copia de la base o del ítem', () => {
    expect(valoresIniciales().prioridad).toBeNull()
    expect(valoresIniciales(crearItem({ prioridad: 'Alta' })).prioridad).toBe('Alta')
    expect(valoresDeItem(crearItem({ prioridad: 'Baja' })).prioridad).toBe('Baja')
  })

  it('aDatosItem envía la prioridad elegida o null cuando está vacía', () => {
    expect(aDatosItem({ ...validos(), prioridad: 'Urgente' }).prioridad).toBe('Urgente')
    expect(aDatosItem({ ...validos(), prioridad: '' }).prioridad).toBeNull()
    expect(aDatosItem({ ...validos(), prioridad: null }).prioridad).toBeNull()
  })
})

describe('valoresDeItem', () => {
  it('conserva el bloqueo del ítem', () => {
    const item = crearItem({ bloqueado: true, motivo_bloqueo: 'Sin API' })
    expect(valoresDeItem(item)).toMatchObject({ bloqueado: true, motivo_bloqueo: 'Sin API' })
  })
})

describe('validar', () => {
  it('un formulario completo no tiene errores', () => {
    expect(validar(validos())).toEqual([])
  })

  it.each(['cliente', 'actividad', 'modulo', 'funcionalidad', 'alcance'])('exige %s', (campo) => {
    const errores = validar({ ...validos(), [campo]: '   ' })
    expect(errores).toHaveLength(1)
    expect(errores[0]).toMatch(/Completa los campos/)
  })

  it('detecta cada tramo con fin anterior al inicio', () => {
    const errores = validar({
      ...validos(),
      plan_ini: '2026-02-01',
      plan_fin: '2026-01-01',
      real_pruebas_ini: '2026-03-10',
      real_pruebas_fin: '2026-03-01',
    })
    expect(errores).toHaveLength(2)
    expect(errores[0]).toMatch(/desarrollo planificado/)
    expect(errores[1]).toMatch(/pruebas ejecutadas/)
  })

  it('acepta fin igual al inicio', () => {
    expect(validar({ ...validos(), plan_ini: '2026-02-01', plan_fin: '2026-02-01' })).toEqual([])
  })

  it('no valida tramos incompletos', () => {
    expect(validar({ ...validos(), plan_fin: '2026-01-01' })).toEqual([])
  })

  it('exige motivo si está bloqueado', () => {
    expect(validar({ ...validos(), bloqueado: true, motivo_bloqueo: '  ' })).toEqual([
      'Indica el motivo del bloqueo: se incluye en el correo de alerta.',
    ])
  })

  it('acumula varios errores', () => {
    const errores = validar({ ...validos(), cliente: '', bloqueado: true, motivo_bloqueo: '' })
    expect(errores).toHaveLength(2)
  })
})

describe('aDatosItem', () => {
  it('limpia nombres de catálogo y recorta el motivo', () => {
    const datos = aDatosItem({
      ...validos(),
      cliente: '  AIR-E  ',
      modulo: 'Torre   de Control',
      bloqueado: true,
      motivo_bloqueo: '  Sin API ',
    })
    expect(datos).toMatchObject({ cliente: 'AIR-E', modulo: 'Torre de Control', motivo_bloqueo: 'Sin API', bloqueado: true })
  })

  it('vacía el motivo cuando no está bloqueado', () => {
    expect(aDatosItem({ ...validos(), motivo_bloqueo: 'viejo' }).motivo_bloqueo).toBe('')
  })

  it('no incluye nota ni tipo de nota', () => {
    const datos = aDatosItem({ ...validos(), nota: 'hola', tipoNota: 'Ejecución' })
    expect(datos).not.toHaveProperty('nota')
    expect(datos).not.toHaveProperty('tipoNota')
  })

  it('envía las ocho fechas', () => {
    const datos = aDatosItem({ ...validos(), plan_ini: '2026-01-01', real_pruebas_fin: '2026-02-01' })
    expect(Object.keys(datos).filter((k) => /^(plan|real)_/.test(k))).toHaveLength(8)
    expect(datos.plan_ini).toBe('2026-01-01')
  })
})
