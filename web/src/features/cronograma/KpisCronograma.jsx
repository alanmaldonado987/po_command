import { Kpi, KpiGrid } from '../../components/ui'
import { ESTADO_PRUEBAS, PALETA } from '../../lib/constantes'

export function KpisCronograma({ cliente, items, sinFechas }) {
  return (
    <KpiGrid>
      <Kpi etiqueta="Ítems en vista" valor={items.length} detalle={cliente} color={PALETA.azul} />
      <Kpi
        etiqueta="Atrasados"
        valor={items.filter((item) => item.atrasado).length}
        detalle="Pasaron su fin planificado"
        color={PALETA.rojo}
      />
      <Kpi
        etiqueta="En pruebas"
        valor={items.filter((item) => item.estado === ESTADO_PRUEBAS).length}
        detalle={ESTADO_PRUEBAS}
        color={PALETA.ambar}
      />
      <Kpi etiqueta="Sin fechas" valor={sinFechas} detalle="Falta planificarlos" color={PALETA.gris} />
    </KpiGrid>
  )
}
