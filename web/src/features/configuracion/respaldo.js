import { leerTabla, TABLAS_EXPORTABLES } from '../../api/configuracion'
import { hoyIso } from '../../lib/fechas'
import { descargarLibro } from '../../lib/excel/descargar'
import { libroDeTablas } from '../../lib/excel/exportarTablas'

export async function descargarRespaldo() {
  const filas = await Promise.all(TABLAS_EXPORTABLES.map(leerTabla))
  const tablas = Object.fromEntries(TABLAS_EXPORTABLES.map((tabla, indice) => [tabla, filas[indice]]))
  descargarLibro(libroDeTablas(tablas), `po_command_${hoyIso().replaceAll('-', '')}.xlsx`)
}
