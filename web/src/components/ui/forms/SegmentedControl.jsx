import { cx } from '../../../lib/cx'
import { aOpciones } from './SelectField'

export function SegmentedControl({ label, opciones, value, onChange, className }) {
  return (
    <div className={cx('min-w-0', className)}>
      {label && <span className="field-label">{label}</span>}
      <div role="group" className="inline-flex flex-wrap gap-0.5 rounded-[10px] border border-line bg-line-soft p-0.5">
        {aOpciones(opciones).map((opcion) => (
          <button
            key={String(opcion.value)}
            type="button"
            aria-pressed={opcion.value === value}
            onClick={() => onChange(opcion.value)}
            className={cx(
              'min-h-[34px] rounded-lg px-3 text-sm font-semibold transition-colors',
              opcion.value === value ? 'bg-white text-ink shadow-item' : 'text-ink-muted hover:text-ink',
            )}
          >
            {opcion.label}
          </button>
        ))}
      </div>
    </div>
  )
}
