import { Field } from './Field'

export function DateField({ label, ayuda, className, value, onChange, tipo = 'date', ...props }) {
  return (
    <Field label={label} ayuda={ayuda} className={className}>
      <input
        type={tipo}
        className="field-control"
        value={value ?? ''}
        onChange={(evento) => onChange(evento.target.value || null)}
        {...props}
      />
    </Field>
  )
}
