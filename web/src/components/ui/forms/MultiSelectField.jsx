import { cx } from '../../../lib/cx'
import { Icon } from '../Icon'
import { Popover } from '../Popover'
import { aOpciones } from './SelectField'

export function MultiSelectField({ label, opciones, value = [], onChange, placeholder = 'Todos', className }) {
  const lista = aOpciones(opciones)
  const etiquetas = lista.filter((opcion) => value.includes(opcion.value)).map((opcion) => opcion.label)
  const alternar = (valor) =>
    onChange(value.includes(valor) ? value.filter((actual) => actual !== valor) : [...value, valor])

  return (
    <div className={cx('block min-w-0', className)}>
      {label && <span className="field-label">{label}</span>}
      <Popover
        className="max-h-64 w-full min-w-[220px] overflow-y-auto"
        renderTrigger={({ alternar: abrir }) => (
          <button
            type="button"
            onClick={abrir}
            aria-label={label}
            aria-haspopup="listbox"
            className="field-control flex items-center justify-between gap-2 text-left"
          >
            <span className={cx('truncate', etiquetas.length === 0 && 'text-slate-400')}>
              {etiquetas.length ? etiquetas.join(', ') : placeholder}
            </span>
            <Icon name="expand_more" className="flex-none text-ink-muted" />
          </button>
        )}
      >
        {lista.length === 0 && <p className="text-sm text-ink-muted">Sin opciones</p>}
        {lista.map((opcion) => (
          <label key={String(opcion.value)} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-line-soft">
            <input
              type="checkbox"
              checked={value.includes(opcion.value)}
              onChange={() => alternar(opcion.value)}
              className="h-4 w-4 accent-brand"
            />
            {opcion.label}
          </label>
        ))}
      </Popover>
    </div>
  )
}
