import * as XLSX from 'xlsx'

const LARGO_MAXIMO_HOJA = 31

const aCelda = (valor) => (Array.isArray(valor) ? valor.join(', ') : valor)

export function libroDeTablas(tablas) {
  const libro = XLSX.utils.book_new()
  Object.entries(tablas).forEach(([nombre, filas]) => {
    const planas = filas.map((fila) => Object.fromEntries(Object.entries(fila).map(([k, v]) => [k, aCelda(v)])))
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(planas), nombre.slice(0, LARGO_MAXIMO_HOJA))
  })
  return libro
}
