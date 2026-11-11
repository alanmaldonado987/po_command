import { formatoFechaHora } from '../../lib/fechas'
import { PALETA } from '../../lib/constantes'
import { Card, Kpi, KpiGrid } from '../../components/ui'
import { AccionesSincronizacion } from './AccionesSincronizacion'
import { ImportarExistentes } from './ImportarExistentes'

function KpiAccionable({ nombre, cantidad, onClick, children }) {
  if (!onClick) return children
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${nombre}: ${cantidad}. Ver detalle`}
      className="rounded-card text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      {children}
    </button>
  )
}

export function TarjetaSincronizacion({ estado, onVerCola }) {
  const pendientes = estado.pendientes ?? 0
  const conError = estado.con_error ?? 0
  return (
    <Card title="Webhook y estado" icon="sync_alt" subtitle="Vigila la sincronización y lánzala a mano cuando lo necesites.">
      <KpiGrid minimo={130}>
        <KpiAccionable nombre="Pendientes" cantidad={pendientes} onClick={onVerCola && (() => onVerCola('pendientes'))}>
          <Kpi etiqueta="Pendientes" valor={pendientes} color={PALETA.azul} detalle={onVerCola ? 'Ver detalle →' : undefined} />
        </KpiAccionable>
        <KpiAccionable nombre="Con error" cantidad={conError} onClick={onVerCola && (() => onVerCola('errores'))}>
          <Kpi
            etiqueta="Con error"
            valor={conError}
            color={PALETA.rojo}
            colorValor={conError ? '#B91C1C' : undefined}
            detalle={onVerCola ? 'Ver detalle →' : undefined}
          />
        </KpiAccionable>
        <Kpi etiqueta="Webhook" valor={estado.webhook_registrado ? 'Activo' : 'Sin registrar'} color={PALETA.violeta} />
        <Kpi etiqueta="Último sync" valor={estado.ultimo_sync ? formatoFechaHora(estado.ultimo_sync) : 'Nunca'} color={PALETA.verde} />
      </KpiGrid>
      <AccionesSincronizacion estado={estado} />
      <ImportarExistentes estado={estado} />
    </Card>
  )
}
