import { cx } from '../../lib/cx'
import { Icon } from './Icon'

export function Card({ title, icon, subtitle, actions, className, children }) {
  return (
    <section
      className={cx(
        'flex flex-col gap-2.5 rounded-card border border-line bg-white px-5 py-[18px] shadow-card max-sm:p-3.5',
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2">
          {title && (
            <h5 className="flex items-center gap-1.5 text-base font-bold leading-snug text-ink">
              {icon && <Icon name={icon} className="text-ink-muted" />}
              {title}
            </h5>
          )}
          {actions}
        </header>
      )}
      {subtitle && <p className="-mt-1 text-[13px] text-ink-muted">{subtitle}</p>}
      {children}
    </section>
  )
}
