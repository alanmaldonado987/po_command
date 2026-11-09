import { cx } from '../../lib/cx'

export function Icon({ name, className }) {
  return (
    <span className={cx('material-symbols-rounded', className)} aria-hidden="true">
      {name}
    </span>
  )
}
