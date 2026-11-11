import { formatoFechaHora } from '../../lib/fechas'
import { tonoEstado } from '../../lib/tonos'
import { ACCIONES_COLA, explicarError } from '../../lib/colaClickUp'
import { ListItem } from '../../components/ui'

const LARGO_RESUMEN = 240

function DetalleError({ error }) {
  const largo = error.length > LARGO_RESUMEN
  const explicacion = explicarError(error)
  return (
    <div className="mt-1.5 space-y-1.5 text-[13px]">
      <p className="whitespace-pre-wrap break-words font-mono text-xs text-danger-ink">
        {largo ? `${error.slice(0, LARGO_RESUMEN)}…` : error}
      </p>
      {largo && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-brand">Ver error completo</summary>
          <p className="mt-1 whitespace-pre-wrap break-words font-mono">{error}</p>
        </details>
      )}
      {explicacion && (
        <p className="text-ink-soft">
          <span className="font-semibold">Qué hacer: </span>
          {explicacion}
        </p>
      )}
    </div>
  )
}

export function FilaCola({ fila, item }) {
  const accion = ACCIONES_COLA[fila.accion] ?? fila.accion
  const codigo = item?.codigo ?? `Ítem ${fila.item_id}`
  return (
    <ListItem
      id={`${codigo} · ${accion}`}
      titulo={item?.titulo}
      chips={[[fila.estado, tonoEstado(fila.estado)]]}
      alerta={fila.estado === 'Fallida'}
      meta={[formatoFechaHora(fila.procesado_en ?? fila.creado_en), `Intentos: ${fila.intentos}`]}
    >
      {fila.error && <DetalleError error={fila.error} />}
    </ListItem>
  )
}
