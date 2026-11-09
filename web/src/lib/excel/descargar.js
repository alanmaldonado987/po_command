import * as XLSX from 'xlsx'

export function descargarLibro(libro, nombreArchivo) {
  const bytes = XLSX.write(libro, { type: 'array', bookType: 'xlsx' })
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(
    new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  )
  enlace.download = nombreArchivo
  enlace.click()
  URL.revokeObjectURL(enlace.href)
}
