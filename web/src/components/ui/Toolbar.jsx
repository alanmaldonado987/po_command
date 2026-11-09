import { cx } from '../../lib/cx'

export function Toolbar({ className, children }) {
  return (
    <div className={cx('flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white px-3 py-2.5', className)}>
      {children}
    </div>
  )
}
