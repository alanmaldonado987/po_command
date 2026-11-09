import { formatoFechaHora } from '../../lib/fechas'
import { PALETA } from '../../lib/constantes'
import { Card, Kpi, KpiGrid } from '../../components/ui'
import { AccionesSincronizacion } from './AccionesSincronizacion'
import { ImportarExistentes } from './ImportarExistentes'

export function TarjetaSincronizacion({ estado }) {
  return (
    <Card title="Webhook y estado" icon="sync_alt" subtitle="Vigila la sincronización y lánzala a mano cuando lo necesites.">
      <KpiGrid minimo={130}>
        <Kpi etiqueta="Pendientes" valor={estado.pendientes ?? 0} color={PALETA.azul} />
        <Kpi
          etiqueta="Con error"
          valor={estado.con_error ?? 0}
          color={PALETA.rojo}
          colorValor={estado.con_error ? '#B91C1C' : undefined}
        />
        <Kpi etiqueta="Webhook" valor={estado.webhook_registrado ? 'Activo' : 'Sin registrar'} color={PALETA.violeta} />
        <Kpi etiqueta="Último sync" valor={estado.ultimo_sync ? formatoFechaHora(estado.ultimo_sync) : 'Nunca'} color={PALETA.verde} />
      </KpiGrid>
      <AccionesSincronizacion estado={estado} />
      <ImportarExistentes estado={estado} />
    </Card>
  )
}
