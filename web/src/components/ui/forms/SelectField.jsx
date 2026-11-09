import { Field } from './Field'

export const aOpciones = (lista) =>
  lista.map((opcion) => (typeof opcion === 'object' && opcion !== null ? opcion : { value: opcion, label: String(opcion) }))

export function SelectField({ label, ayuda, className, opciones, value, onChange, placeholder, ...props }) {
  const lista = aOpciones(opciones)
  const alCambiar = (evento) => {
    const elegida = lista.find((opcion) => String(opcion.value) === evento.target.value)
    onChange?.(elegida ? elegida.value : null)
  }

  return (
    <Field label={label} ayuda={ayuda} className={className}>
      <select className="field-control" value={value == null ? '' : String(value)} onChange={alCambiar} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {lista.map((opcion) => (
          <option key={String(opcion.value)} value={String(opcion.value)}>
            {opcion.label}
          </option>
        ))}
      </select>
    </Field>
  )
}
