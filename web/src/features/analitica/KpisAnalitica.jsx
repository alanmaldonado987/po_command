import { Kpi, KpiGrid } from '../../components/ui'
import { PALETA } from '../../lib/constantes'

export function KpisAnalitica({ kpis }) {
  return (
    <KpiGrid>
      <Kpi
        etiqueta="Avance"
        valor={`${kpis.avance.toFixed(0)}%`}
        detalle={`${kpis.terminados} de ${kpis.total} ítems terminados`}
        color={PALETA.verde}
        porcentaje={kpis.avance}
      />
      <Kpi
        etiqueta="Entrega a tiempo"
        valor={kpis.entregaATiempo === null ? '-' : `${kpis.entregaATiempo.toFixed(0)}%`}
        detalle="Terminados en su fecha planificada"
        color={PALETA.azul}
        porcentaje={kpis.entregaATiempo ?? 0}
      />
      <Kpi
        etiqueta="Atrasados"
        valor={kpis.atrasados}
        detalle={kpis.atrasados ? `${kpis.promedioAtraso.toFixed(0)} días en promedio` : 'Ninguno'}
        color={PALETA.rojo}
      />
      <Kpi
        etiqueta="Reprogramaciones"
        valor={kpis.reprogramaciones}
        detalle="Cambios de fecha registrados en la app"
        color={PALETA.ambar}
      />
      <Kpi
        etiqueta="Resolución de bloqueos"
        valor={kpis.horasResolucion === null ? '-' : `${kpis.horasResolucion.toFixed(0)} h`}
        detalle="Promedio de los resueltos"
        color={PALETA.violeta}
      />
    </KpiGrid>
  )
}
