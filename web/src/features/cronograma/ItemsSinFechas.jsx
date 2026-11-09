import { DataTable, Expander } from '../../components/ui'

const COLUMNAS = [
  { clave: 'codigo', titulo: 'Código', ancho: 90 },
  { clave: 'actividad', titulo: 'Actividad', ancho: 140 },
  { clave: 'modulo', titulo: 'Módulo', ancho: 180 },
  { clave: 'funcionalidad', titulo: 'Funcionalidad', ancho: 220 },
  { clave: 'alcance', titulo: 'Alcance', ancho: 100 },
  { clave: 'responsable', titulo: 'Responsable', ancho: 160 },
  { clave: 'estado', titulo: 'Estado', ancho: 180 },
]

export function ItemsSinFechas({ items }) {
  if (items.length === 0) return null
  return (
    <Expander titulo={`${items.length} ítem(s) sin fechas`} icono="event_busy">
      <DataTable columnas={COLUMNAS} filas={items} claveFila={(item) => item.id} />
    </Expander>
  )
}
