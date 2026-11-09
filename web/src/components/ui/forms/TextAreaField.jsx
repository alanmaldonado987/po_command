import { Field } from './Field'

export function TextAreaField({ label, ayuda, className, onChange, filas = 3, ...props }) {
  return (
    <Field label={label} ayuda={ayuda} className={className}>
      <textarea
        rows={filas}
        className="field-control resize-y py-2"
        onChange={(evento) => onChange?.(evento.target.value)}
        {...props}
      />
    </Field>
  )
}
