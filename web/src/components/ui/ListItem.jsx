import { cx } from '../../lib/cx'
import { Chip } from './Chip'

export function ListItem({
  id,
  titulo,
  cuerpo,
  meta = [],
  chips = [],
  alerta = false,
  seleccionado = false,
  className,
  children,
}) {
  return (
    <article
      className={cx(
        'rounded-xl border border-line bg-white px-3.5 py-3',
        alerta && 'border-l-4 border-l-danger',
        seleccionado && 'border-brand shadow-[0_0_0_1px_#0369A1]',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-ink-muted">{id}</span>
        <span className="flex flex-wrap gap-1.5">
          {chips.map(([texto, tono]) => (
            <Chip key={texto} tono={tono}>
              {texto}
            </Chip>
          ))}
        </span>
      </div>
      {titulo && <div className="mb-0.5 mt-1 text-sm font-semibold leading-snug text-ink">{titulo}</div>}
      {cuerpo && <div className="text-[13px] leading-snug text-ink-soft">{cuerpo}</div>}
      {children}
      {meta.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-ink-muted">
          {meta.map((dato, indice) => (
            <span key={indice}>{dato}</span>
          ))}
        </div>
      )}
    </article>
  )
}

export const ListaItems = ({ className, children }) => (
  <div className={cx('flex flex-col gap-2', className)}>{children}</div>
)
