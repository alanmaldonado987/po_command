import { useState } from 'react'
import { AUDIENCIAS, TONO_CEREMONIA } from '../../lib/constantes'
import { aIsoFecha, formatoHora, mesCorto } from '../../lib/fechas'
import { CLASES_TONO } from '../../lib/tonos'
import { cx } from '../../lib/cx'
import { Button, Card, Chip, EmptyState, Toggle } from '../../components/ui'

function TarjetaCeremonia({ ceremonia, seleccionada, alElegir }) {
  const fecha = new Date(ceremonia.fecha_hora)
  const tono = TONO_CEREMONIA[ceremonia.tipo] ?? 'gris'
  return (
    <div className="space-y-1.5">
      <div
        className={cx(
          'flex items-center gap-3 rounded-xl border bg-white px-3.5 py-3',
          seleccionada ? 'border-brand shadow-[0_0_0_1px_#0369A1]' : 'border-line',
        )}
      >
        <div className={cx('w-[52px] flex-none rounded-[10px] py-1.5 text-center', CLASES_TONO[tono])}>
          <div className="text-[10px] font-bold">{mesCorto(fecha)}</div>
          <div className="text-xl font-extrabold leading-tight">{fecha.getDate()}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-snug text-ink">{ceremonia.titulo}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-3.5 text-xs text-ink-muted">
            <span>
              {formatoHora(fecha)} · {ceremonia.duracion_min} min
            </span>
            <span>{AUDIENCIAS[ceremonia.audiencia]}</span>
            {ceremonia.cliente && <span>{ceremonia.cliente}</span>}
          </div>
        </div>
        <Chip tono={ceremonia.invitacion_enviada ? 'verde' : 'ambar'}>
          {ceremonia.invitacion_enviada ? 'Invitación enviada' : 'Sin enviar'}
        </Chip>
      </div>
      <Button full disabled={seleccionada} onClick={alElegir}>
        {seleccionada ? 'Seleccionada' : 'Ver detalle'}
      </Button>
    </div>
  )
}

export function AgendaCeremonias({ ceremonias, seleccionId, alElegir, alAgendar }) {
  const [verPasadas, setVerPasadas] = useState(false)
  const hoy = aIsoFecha(new Date())
  const lista = verPasadas ? ceremonias : ceremonias.filter((c) => aIsoFecha(new Date(c.fecha_hora)) >= hoy)

  return (
    <Card title="Próximas ceremonias" icon="calendar_month">
      <div className="flex items-center justify-between gap-2">
        <Toggle label="Ver pasadas" checked={verPasadas} onChange={setVerPasadas} />
        <Button variant="primary" icon="add" onClick={alAgendar}>
          Agendar
        </Button>
      </div>
      {lista.length === 0 && <EmptyState>No hay ceremonias próximas.</EmptyState>}
      {lista.map((ceremonia) => (
        <TarjetaCeremonia
          key={ceremonia.id}
          ceremonia={ceremonia}
          seleccionada={seleccionId === ceremonia.id}
          alElegir={() => alElegir(ceremonia.id)}
        />
      ))}
    </Card>
  )
}
