import { DataTable, Expander } from '../../components/ui'
import { ESTADOS } from '../../lib/constantes'
import { resumenClienteActividad } from './metricas'

const COLUMNAS = [
  { clave: 'cliente', titulo: 'Cliente', ancho: 140 },
  { clave: 'actividad', titulo: 'Actividad', ancho: 160 },
  ...ESTADOS.map((estado) => ({ clave: estado, titulo: estado, ancho: 110 })),
  { clave: 'Atrasados', titulo: 'Atrasados', ancho: 100 },
]

export function TablaClienteActividad({ items }) {
  return (
    <Expander titulo="Ver datos por cliente y actividad" icono="table">
      <DataTable columnas={COLUMNAS} filas={resumenClienteActividad(items)} claveFila={(fila) => fila.clave} />
    </Expander>
  )
}
