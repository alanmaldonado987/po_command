import { cx } from '../../../lib/cx'

export function Toggle({ label, checked, onChange, disabled = false, className }) {
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-ink-soft', disabled && 'cursor-not-allowed opacity-50', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-6 w-11 flex-none rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
          checked ? 'bg-brand' : 'bg-slate-300',
        )}
      >
        <span
          className={cx(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
      {label}
    </label>
  )
}
