import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { fechaDeNota, partirConsideraciones } from './consideraciones'
import { exportarPlan } from './exportarPlan'
import { leerPlan } from './leerPlan'
import { normalizarCampo } from './normalizar'
import { prepararFilas } from './prepararFilas'

const ARCHIVO = resolve(__dirname, '../../../../data_inicial/plan_de_trabajo.xlsx')
const { filas, avisos } = leerPlan(new Uint8Array(readFileSync(ARCHIVO)))

describe('normalizarCampo', () => {
  it('corrige alias y typos conocidos', () => {
    expect(normalizarCampo('fase', 'Cutomización')).toBe('Customización')
    expect(normalizarCampo('modulo', ' Ordenes ')).toBe('Órdenes')
    expect(normalizarCampo('actividad', 'multi familiares SCR')).toBe('Multifamiliares SCR')
    expect(normalizarCampo('persona', 'Por definir')).toBe('')
    expect(normalizarCampo('cliente', null)).toBe('')
  })
})

describe('consideraciones', () => {
  it('lee la fecha con la que empieza una nota', () => {
    expect(fechaDeNota('25AGO: arranca', 2026)).toBe('2026-08-25')
    expect(fechaDeNota('Sept 22: ajuste', 2026)).toBe('2026-09-22')
    expect(fechaDeNota('Oct 2: listo', 2026)).toBe('2026-10-02')
    expect(fechaDeNota('sin fecha', 2026)).toBeNull()
    expect(fechaDeNota('31FEB: imposible', 2026)).toBeNull()
  })

  it('une las líneas sin fecha a la nota anterior', () => {
    expect(partirConsideraciones('25AGO: uno\ncontinúa\n31AGO: dos')).toEqual(['25AGO: uno continúa', '31AGO: dos'])
  })
})

describe('leerPlan con el Plan de Trabajo inicial', () => {
  it('lee las cuatro hojas y todas las filas', () => {
    const porHoja = filas.reduce((conteo, { hoja }) => ({ ...conteo, [hoja]: (conteo[hoja] ?? 0) + 1 }), {})
    expect(porHoja).toEqual({ 'AIR-E': 114, AFINIA: 65, ELECTROHUILA: 59, ACUACAR: 36 })
    expect(filas.length).toBe(274)
    expect(avisos).toHaveLength(3)
  })

  it('extrae las mismas consideraciones que el importador original', () => {
    const notas = filas.reduce((total, f) => total + f.consid_plan.length + f.consid_real.length, 0)
    expect(notas).toBe(152)
  })

  it('normaliza la primera fila igual que el importador original', () => {
    const [primera] = filas
    expect(primera).toMatchObject({
      cliente: 'AIR-E',
      actividad: 'SCR',
      modulo: 'Planeación Operativa',
      fase: 'Desarrollo',
      alcance: 'Web',
      responsable: 'Dairo Carrasquilla',
      estado: 'Terminado',
      plan_ini: '2026-08-10',
      plan_fin: '2026-08-25',
      plan_pruebas_ini: '2026-08-26',
      plan_pruebas_fin: '2026-09-04',
    })
    expect(primera.consid_plan[0].fecha).toBe('2026-08-25')
  })

  it('genera claves únicas y filas compatibles con importar_plan', () => {
    const preparadas = prepararFilas(filas)
    expect(new Set(preparadas.map((f) => f.clave)).size).toBe(preparadas.length)
    preparadas.forEach((fila) => {
      expect(fila.clave).toBeTruthy()
      expect(fila.funcionalidad).toBeTruthy()
      expect(fila.estado).toBeTruthy()
      expect(Array.isArray(fila.consid_plan)).toBe(true)
      expect(Array.isArray(fila.consid_real)).toBe(true)
    })
  })
})

describe('exportarPlan', () => {
  it('crea una hoja por cliente con la cabecera del Plan de Trabajo', () => {
    const items = filas.slice(0, 5).map((fila, i) => ({ ...fila, id: i + 1, codigo: `BL-00${i + 1}`, producto: 'FieldOps' }))
    const libro = exportarPlan(items, [{ id: 1, item_id: 1, tipo: 'Planificación', fecha: '2026-08-25', texto: 'nota' }])
    expect(libro.SheetNames).toEqual(['AIR-E'])
    const hoja = libro.Sheets['AIR-E']
    const filasHoja = XLSX.utils.sheet_to_json(hoja, { header: 1 })
    expect(filasHoja[2][2]).toBe('Menú/Funcionalidad')
    expect(filasHoja[3][11]).toBe('nota')
    expect(hoja['!merges']).toHaveLength(6)
    expect(hoja.H4.z).toBe('dd/mm/yyyy')
  })
})
