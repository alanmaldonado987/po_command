import { cx } from '../../lib/cx'
import { CLASES_TONO } from '../../lib/tonos'

export function Chip({ tono = 'gris', punto = false, className, children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold leading-snug',
        CLASES_TONO[tono] ?? CLASES_TONO.gris,
        className,
      )}
    >
      {punto && <i className="inline-block h-[7px] w-[7px] rounded-full bg-current" />}
      {children}
    </span>
  )
}
