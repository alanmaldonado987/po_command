import { Avatar, Card, Meter } from '../../components/ui'
import { PALETA } from '../../lib/constantes'
import { cargaPorResponsable } from '../../lib/dominio'

function FilaCarga({ nombre, abiertos, atrasados, maximo }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
      <Avatar nombre={nombre} tono={atrasados ? 'rojo' : 'azul'} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-bold text-ink">{nombre}</span>
          <span className="text-xs font-bold text-ink-soft">
            {abiertos} abiertos{atrasados ? ` · ${atrasados} atrasados` : ''}
          </span>
        </div>
        <Meter porcentaje={(abiertos / maximo) * 100} color={atrasados ? PALETA.ambar : PALETA.azul} />
      </div>
    </div>
  )
}

export function CargaPorResponsable({ items }) {
  const carga = Object.entries(cargaPorResponsable(items)).sort(([, a], [, b]) => b.abiertos - a.abiertos)
  const maximo = Math.max(1, ...carga.map(([, valor]) => valor.abiertos))

  return (
    <Card title="Carga por responsable" icon="groups" subtitle="Ítems abiertos de cada persona del equipo.">
      <div className="flex flex-col gap-2">
        {carga.map(([nombre, valor]) => (
          <FilaCarga key={nombre} nombre={nombre} maximo={maximo} {...valor} />
        ))}
      </div>
    </Card>
  )
}
