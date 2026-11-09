import { cx } from '../../lib/cx'
import { Icon } from './Icon'

const VARIANTES = {
  primary: 'bg-brand text-white hover:bg-brand-dark border-transparent',
  secondary: 'bg-white text-ink border-line hover:bg-line-soft',
  ghost: 'bg-transparent text-ink-soft border-transparent hover:bg-line-soft',
  danger: 'bg-danger text-white border-transparent hover:bg-red-700',
}

const TAMANOS = {
  md: 'min-h-[40px] px-4 text-sm',
  sm: 'min-h-[32px] px-2.5 text-[13px]',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading = false,
  full = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-[10px] border font-semibold transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTES[variant],
        TAMANOS[size],
        full && 'w-full',
        className,
      )}
      {...props}
    >
      {icon && <Icon name={loading ? 'progress_activity' : icon} className={cx('text-[18px]', loading && 'animate-spin')} />}
      {children}
    </button>
  )
}
