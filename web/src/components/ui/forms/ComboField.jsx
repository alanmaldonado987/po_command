import { useId } from 'react'
import { Field } from './Field'

export function ComboField({ label, ayuda, className, opciones, value, onChange, placeholder, ...props }) {
  const idLista = useId()
  return (
    <Field label={label} ayuda={ayuda} className={className}>
      <input
        list={idLista}
        className="field-control"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(evento) => onChange(evento.target.value)}
        {...props}
      />
      <datalist id={idLista}>
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion} />
        ))}
      </datalist>
    </Field>
  )
}
