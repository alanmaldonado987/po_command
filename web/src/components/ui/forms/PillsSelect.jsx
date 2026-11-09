import { cx } from '../../../lib/cx'
import { aOpciones } from './SelectField'

export function PillsSelect({ label, opciones, value = [], onChange, multiple = true, className }) {
  const alternar = (valor) => {
    if (!multiple) return onChange(valor)
    onChange(value.includes(valor) ? value.filter((actual) => actual !== valor) : [...value, valor])
  }
  const activa = (valor) => (multiple ? value.includes(valor) : value === valor)

  return (
    <div className={className}>
      {label && <span className="field-label">{label}</span>}
      <div className="flex flex-wrap gap-1.5">
        {aOpciones(opciones).map((opcion) => (
          <button
            key={String(opcion.value)}
            type="button"
            aria-pressed={activa(opcion.value)}
            onClick={() => alternar(opcion.value)}
            className={cx(
              'rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors',
              activa(opcion.value)
                ? 'border-brand bg-brand-soft text-brand-dark'
                : 'border-line bg-white text-ink-soft hover:bg-line-soft',
            )}
          >
            {opcion.label}
          </button>
        ))}
      </div>
    </div>
  )
}
