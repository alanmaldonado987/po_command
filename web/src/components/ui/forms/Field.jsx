import { cx } from '../../../lib/cx'

export function Field({ label, ayuda, className, children }) {
  return (
    <label className={cx('block min-w-0', className)}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {ayuda && <span className="mt-1 block text-xs text-ink-muted">{ayuda}</span>}
    </label>
  )
}
