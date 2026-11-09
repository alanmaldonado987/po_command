import * as XLSX from 'xlsx'
import { describe, expect, it, vi } from 'vitest'
import { fechaDeNota, partirConsideraciones } from './consideraciones'
import { descargarLibro } from './descargar'
import { exportarPlan } from './exportarPlan'
import { libroDeTablas } from './exportarTablas'
import { leerPlan } from './leerPlan'
import { clave, normalizarCampo } from './normalizar'
import { claveItem, prepararFilas } from './prepararFilas'

function libroPlan(filasDatos, { titulo = 'AIR-E', encabezados } = {}) {
  const cabecera = encabezados ?? [
    'Cliente', 'Actividad', 'Menú/Funcionalidad', 'Modulo/Componente', 'Fase', 'Alcance', 'Responsable',
    'Fecha inicio', 'Fecha Fin', 'Fecha inicio', 'Fecha Fin', 'Consideraciones',
    'Fecha inicio', 'Fecha Fin', 'Fecha inicio', 'Fecha Fin', 'Consideraciones', 'Estado',
  ]
  const hoja = XLSX.utils.aoa_to_sheet([[], [], cabecera, ...filasDatos])
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, titulo)
  return new Uint8Array(XLSX.write(libro, { type: 'array', bookType: 'xlsx' }))
}

const fila = (extra = {}) => ({
  datos: [
    'AIR-E', 'scr', 'Mapa', 'ordenes', 'desarrollo', 'web', 'Luis Kendor',
    null, null, null, null, '', null, null, null, null, '', '',
  ],
  ...extra,
})

describe('normalizarCampo · bordes', () => {
  it.each([
    ['alcance', 'MOBILE', 'Mobile'],
    ['alcance', 'automatización', 'Automatización'],
    ['estado', 'EN CURSO', 'En curso'],
    ['cliente', 'air-e', 'AIR-E'],
    ['persona', 'Luis Kendor', 'Luis Kendor Narvaez'],
    ['modulo', 'MAESTRO_BD', 'Maestro BD'],
    ['funcionalidad', 'matriz de reocmendacion', 'Matriz de recomendación'],
  ])('%s: %s → %s', (tipo, entrada, esperado) => {
    expect(normalizarCampo(tipo, entrada)).toBe(esperado)
  })

  it('un valor desconocido se conserva limpio', () => {
    expect(normalizarCampo('modulo', '  Módulo   Nuevo ')).toBe('Módulo Nuevo')
  })

  it.each(['', '  ', 'None', 'none', null, undefined])('vacío (%s) devuelve cadena vacía', (valor) => {
    expect(normalizarCampo('actividad', valor)).toBe('')
  })

  it('clave ignora tildes y mayúsculas', () => {
    expect(clave(' ÓRDENES ')).toBe('ordenes')
  })
})

describe('fechaDeNota · bordes', () => {
  it.each([
    ['11SEP: cierre', '2026-09-11'],
    ['1 dic: fin', '2026-12-01'],
    ['Aug 5 nota', '2026-08-05'],
    ['Oct. 12: listo', '2026-10-12'],
    ['29FEB: bisiesto inválido', null],
    ['Texto 25AGO', null],
    ['', null],
  ])('%s → %s', (texto, esperado) => {
    expect(fechaDeNota(texto, 2026)).toBe(esperado)
  })

  it('respeta años bisiestos', () => {
    expect(fechaDeNota('29FEB: ok', 2028)).toBe('2028-02-29')
  })
})

describe('partirConsideraciones · bordes', () => {
  it('maneja vacíos, saltos de línea de Windows y espacios', () => {
    expect(partirConsideraciones(null)).toEqual([])
    expect(partirConsideraciones('')).toEqual([])
    expect(partirConsideraciones('  \r\n  ')).toEqual([])
    expect(partirConsideraciones('25AGO: a\r\n26AGO: b')).toEqual(['25AGO: a', '26AGO: b'])
  })

  it('una primera línea sin fecha abre una nota propia', () => {
    expect(partirConsideraciones('sin fecha\n25AGO: con fecha')).toEqual(['sin fecha', '25AGO: con fecha'])
  })
})

describe('prepararFilas', () => {
  const base = { cliente: 'AIR-E', actividad: 'SCR', modulo: 'Órdenes', funcionalidad: 'Completo', fase: 'Desarrollo', alcance: 'Web' }

  it('claveItem es insensible a tildes y mayúsculas', () => {
    expect(claveItem({ ...base, modulo: 'ORDENES' })).toBe(claveItem({ ...base, modulo: 'Órdenes' }))
  })

  it('numera las filas repetidas con #n', () => {
    const claves = prepararFilas([base, base, base]).map((f) => f.clave)
    expect(claves[1]).toBe(`${claves[0]}#2`)
    expect(claves[2]).toBe(`${claves[0]}#3`)
  })

  it('distingue alcance y fase', () => {
    const claves = prepararFilas([base, { ...base, alcance: 'Mobile' }, { ...base, fase: 'Customización' }]).map((f) => f.clave)
    expect(new Set(claves).size).toBe(3)
  })

  it('no modifica las filas originales', () => {
    const original = { ...base }
    prepararFilas([original])
    expect(original).not.toHaveProperty('clave')
  })
})

describe('leerPlan · casos sintéticos', () => {
  it('lee una fila mínima y normaliza alias', () => {
    const { filas, avisos } = leerPlan(libroPlan([fila().datos]))
    expect(avisos).toEqual([])
    expect(filas).toHaveLength(1)
    expect(filas[0]).toMatchObject({
      cliente: 'AIR-E',
      actividad: 'SCR',
      funcionalidad: 'Mapa',
      modulo: 'Órdenes',
      fase: 'Desarrollo',
      alcance: 'Web',
      responsable: 'Luis Kendor Narvaez',
      estado: 'No iniciado',
      estado_deducido: true,
    })
  })

  it('deduce En curso cuando hay inicio real', () => {
    const datos = fila().datos
    datos[12] = new Date(Date.UTC(2026, 7, 10, 12))
    const { filas } = leerPlan(libroPlan([datos]))
    expect(filas[0].estado).toBe('En curso')
    expect(filas[0].real_ini).toBe('2026-08-10')
  })

  it('respeta el estado explícito sin marcarlo como deducido', () => {
    const datos = fila().datos
    datos[17] = 'Terminado'
    const { filas } = leerPlan(libroPlan([datos]))
    expect(filas[0].estado).toBe('Terminado')
    expect(filas[0]).not.toHaveProperty('estado_deducido')
  })

  it('usa Completo cuando falta la funcionalidad pero hay módulo', () => {
    const datos = fila().datos
    datos[2] = null
    expect(leerPlan(libroPlan([datos])).filas[0].funcionalidad).toBe('Completo')
  })

  it('omite filas sin funcionalidad ni módulo', () => {
    const vacia = fila().datos.map(() => null)
    expect(leerPlan(libroPlan([vacia])).filas).toEqual([])
  })

  it('usa el nombre de la hoja cuando falta el cliente', () => {
    const datos = fila().datos
    datos[0] = null
    expect(leerPlan(libroPlan([datos], { titulo: 'AFINIA' })).filas[0].cliente).toBe('AFINIA')
  })

  it('avisa de fase o alcance fuera de lista', () => {
    const datos = fila().datos
    datos[4] = 'Mantenimiento'
    datos[5] = 'Escritorio'
    const { avisos, filas } = leerPlan(libroPlan([datos]))
    expect(filas[0].fase).toBe('Mantenimiento')
    expect(avisos).toHaveLength(2)
    expect(avisos[0]).toMatch(/fase «Mantenimiento»/)
    expect(avisos[1]).toMatch(/alcance «Escritorio»/)
  })

  it('omite hojas sin encabezados o sin columnas obligatorias', () => {
    const sinEncabezado = leerPlan(libroPlan([], { encabezados: ['Otra', 'Cosa'] }))
    expect(sinEncabezado.filas).toEqual([])
    expect(sinEncabezado.avisos[0]).toMatch(/no encontré la fila de encabezados/)
    const incompleta = leerPlan(libroPlan([], { encabezados: ['Cliente', 'Actividad'] }))
    expect(incompleta.avisos[0]).toMatch(/faltan columnas obligatorias/)
  })

  it('separa las consideraciones en notas con fecha', () => {
    const datos = fila().datos
    datos[11] = '25AGO: arranque\n26AGO: avance'
    datos[16] = '01SEP: cierre'
    const { filas } = leerPlan(libroPlan([datos]))
    expect(filas[0].consid_plan.map((n) => n.fecha)).toEqual(['2026-08-25', '2026-08-26'])
    expect(filas[0].consid_real[0]).toMatchObject({ texto: '01SEP: cierre', fecha: '2026-09-01' })
  })
})

describe('exportar y volver a leer', () => {
  const items = [
    {
      id: 1, codigo: 'BL-001', cliente: 'AIR-E', actividad: 'SCR', funcionalidad: 'Mapa', modulo: 'Órdenes', fase: 'Desarrollo',
      alcance: 'Web', responsable: 'Luis Kendor Narvaez', estado: 'En curso', producto: 'FieldOps',
      plan_ini: '2026-08-10', plan_fin: '2026-08-25', plan_pruebas_ini: '2026-08-26', plan_pruebas_fin: '2026-09-04',
      real_ini: '2026-08-11', real_fin: null, real_pruebas_ini: null, real_pruebas_fin: null,
    },
    {
      id: 2, codigo: 'BL-002', cliente: null, actividad: null, funcionalidad: 'Completo', modulo: 'Torre', fase: 'Customización',
      alcance: 'Mobile', responsable: null, estado: 'No iniciado', producto: 'FieldOps',
      plan_ini: null, plan_fin: null, plan_pruebas_ini: null, plan_pruebas_fin: null,
      real_ini: null, real_fin: null, real_pruebas_ini: null, real_pruebas_fin: null,
    },
  ]
  const notas = [{ id: 1, item_id: 1, tipo: 'Planificación', fecha: '2026-08-25', texto: '25AGO: arranque' }]

  it('conserva fechas, estado y consideraciones al ir y volver', () => {
    const libro = exportarPlan(items, notas)
    const bytes = new Uint8Array(XLSX.write(libro, { type: 'array', bookType: 'xlsx' }))
    const { filas } = leerPlan(bytes)
    const mapa = filas.find((f) => f.funcionalidad === 'Mapa')
    expect(mapa).toMatchObject({
      cliente: 'AIR-E',
      modulo: 'Órdenes',
      estado: 'En curso',
      plan_ini: '2026-08-10',
      plan_fin: '2026-08-25',
      plan_pruebas_fin: '2026-09-04',
      real_ini: '2026-08-11',
      real_fin: null,
    })
    expect(mapa.consid_plan[0].fecha).toBe('2026-08-25')
  })

  it('crea hoja Sin cliente para ítems sin cliente', () => {
    expect(exportarPlan(items, notas).SheetNames).toEqual(['AIR-E', 'Sin cliente'])
  })

  it('sin ítems genera una hoja Plan vacía', () => {
    expect(exportarPlan([], []).SheetNames).toEqual(['Plan'])
  })

  it('evita nombres de hoja repetidos o con caracteres inválidos', () => {
    const base = { ...items[0], id: 9 }
    const libro = exportarPlan([{ ...base, cliente: 'A/B:C' }, { ...base, id: 10, cliente: 'A B C' }], [])
    expect(new Set(libro.SheetNames.map((n) => n.toLowerCase())).size).toBe(2)
    libro.SheetNames.forEach((nombre) => expect(nombre).not.toMatch(/[[\]:*?/\\]/))
  })

  it('separa notas de planificación y ejecución en su columna', () => {
    const libro = exportarPlan(items, [
      { id: 1, item_id: 1, tipo: 'Reprogramación', fecha: '2026-08-01', texto: 'Cambio de fechas' },
      { id: 2, item_id: 1, tipo: 'Seguimiento', fecha: '2026-08-02', texto: 'Avance' },
      { id: 3, item_id: 1, tipo: 'Bloqueo', fecha: '2026-08-03', texto: 'Bloqueado' },
    ])
    const filasHoja = XLSX.utils.sheet_to_json(libro.Sheets['AIR-E'], { header: 1 })
    expect(filasHoja[3][11]).toBe('Cambio de fechas')
    expect(filasHoja[3][16]).toBe('Avance\nBloqueado')
  })
})

describe('libroDeTablas', () => {
  it('convierte arreglos en texto y recorta nombres a 31 caracteres', () => {
    const libro = libroDeTablas({ persona: [{ id: 1, recibe: ['A', 'B'] }], [`${'x'.repeat(40)}`]: [] })
    expect(libro.SheetNames[0]).toBe('persona')
    expect(libro.SheetNames[1]).toHaveLength(31)
    expect(XLSX.utils.sheet_to_json(libro.Sheets.persona)[0].recibe).toBe('A, B')
  })
})

describe('descargarLibro', () => {
  it('crea un enlace con el nombre y lo libera', () => {
    const clic = vi.fn()
    const crear = vi.spyOn(document, 'createElement').mockReturnValue({ click: clic })
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    descargarLibro(exportarPlan([], []), 'plan.xlsx')
    expect(crear).toHaveBeenCalledWith('a')
    expect(clic).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
    crear.mockRestore()
  })
})
