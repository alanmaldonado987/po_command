import { Field } from './Field'

export function NumberField({ label, ayuda, className, value, onChange, ...props }) {
  return (
    <Field label={label} ayuda={ayuda} className={className}>
      <input
        type="number"
        className="field-control"
        value={value ?? ''}
        onChange={(evento) => onChange(evento.target.value === '' ? null : Number(evento.target.value))}
        {...props}
      />
    </Field>
  )
}
