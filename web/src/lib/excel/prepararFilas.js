import { clave } from './normalizar'

const CAMPOS_CLAVE = ['cliente', 'actividad', 'modulo', 'funcionalidad', 'fase', 'alcance']

export const claveItem = (fila) => CAMPOS_CLAVE.map((campo) => clave(fila[campo])).join('|')

export function prepararFilas(filas) {
  const vistos = {}
  return filas.map((fila) => {
    const base = claveItem(fila)
    vistos[base] = (vistos[base] ?? 0) + 1
    return { ...fila, clave: vistos[base] > 1 ? `${base}#${vistos[base]}` : base }
  })
}
