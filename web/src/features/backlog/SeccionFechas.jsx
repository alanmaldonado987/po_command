import { DateField } from '../../components/ui'

export function SeccionFechas({ titulo, campos, valores, cambiar }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold text-ink">{titulo}</legend>
      <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {campos.map(([campo, etiqueta]) => (
          <DateField key={campo} label={etiqueta} value={valores[campo]} onChange={cambiar(campo)} />
        ))}
      </div>
    </fieldset>
  )
}

export const CAMPOS_PLANIFICACION = [
  ['plan_ini', 'Inicio desarrollo / customización'],
  ['plan_fin', 'Fin desarrollo / customización'],
  ['plan_pruebas_ini', 'Inicio ajustes (pruebas)'],
  ['plan_pruebas_fin', 'Fin ajustes (pruebas)'],
]

export const CAMPOS_EJECUCION = [
  ['real_ini', 'Inicio real desarrollo / customización'],
  ['real_fin', 'Fin real desarrollo / customización'],
  ['real_pruebas_ini', 'Inicio real ajustes (pruebas)'],
  ['real_pruebas_fin', 'Fin real ajustes (pruebas)'],
]
