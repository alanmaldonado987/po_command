import { PALETA } from '../../lib/constantes'
import { porcentaje } from '../../lib/texto'
import { Kpi, KpiGrid } from '../../components/ui'

export function KpisAlertas({ reglas, conteo }) {
  const activas = reglas.filter((regla) => regla.activa).length
  return (
    <KpiGrid>
      <Kpi
        etiqueta="Reglas activas"
        valor={`${activas} / ${reglas.length}`}
        detalle=""
        color={PALETA.verde}
        porcentaje={porcentaje(activas, reglas.length)}
      />
      <Kpi etiqueta="En cola" valor={conteo?.pendientes ?? 0} detalle="Pendientes de envío" color={PALETA.azul} />
      <Kpi etiqueta="Enviadas hoy" valor={conteo?.enviadasHoy ?? 0} detalle="" color={PALETA.violeta} />
      <Kpi etiqueta="Fallidas" valor={conteo?.fallidas ?? 0} detalle="Tras 3 intentos" color={PALETA.rojo} />
    </KpiGrid>
  )
}
