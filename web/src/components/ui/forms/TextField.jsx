import { cx } from '../../../lib/cx'
import { Icon } from '../Icon'
import { Field } from './Field'

export function TextField({ label, ayuda, icono, className, onChange, ...props }) {
  return (
    <Field label={label} ayuda={ayuda} className={className}>
      <span className="relative block">
        {icono && <Icon name={icono} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-muted" />}
        <input
          className={cx('field-control', icono && 'pl-9')}
          onChange={(evento) => onChange?.(evento.target.value)}
          {...props}
        />
      </span>
    </Field>
  )
}
