import { ALCANCES, ESTADOS, FASES, PRIORIDADES } from '../../lib/constantes'
import { usePersonas } from '../../hooks/usePersonas'
import { SelectField } from '../../components/ui'

const conActual = (lista, actual) => (actual && !lista.includes(actual) ? [...lista, actual] : lista)

export function SeccionDetalle({ valores, cambiar }) {
  const { data: personas = [] } = usePersonas()
  const equipo = personas.filter((persona) => persona.tipo === 'equipo' && persona.activo)
  const responsables = equipo.map((persona) => ({ value: persona.id, label: persona.nombre }))
  const asignado = personas.find((persona) => persona.id === valores.responsable_id)
  if (asignado && !responsables.some((r) => r.value === asignado.id)) {
    responsables.push({ value: asignado.id, label: asignado.nombre })
  }

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold text-ink">Detalle</legend>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <SelectField label="Fase" opciones={conActual(FASES, valores.fase)} value={valores.fase} onChange={cambiar('fase')} />
        <SelectField
          label="Alcance *"
          opciones={conActual(ALCANCES, valores.alcance)}
          value={valores.alcance}
          onChange={cambiar('alcance')}
          placeholder="Web, Mobile…"
        />
        <SelectField
          label="Responsable"
          opciones={responsables}
          value={valores.responsable_id}
          onChange={cambiar('responsable_id')}
          placeholder="Sin asignar"
        />
        <SelectField label="Estado" opciones={ESTADOS} value={valores.estado} onChange={cambiar('estado')} />
        <SelectField
          label="Prioridad"
          opciones={conActual(PRIORIDADES, valores.prioridad)}
          value={valores.prioridad}
          onChange={cambiar('prioridad')}
          placeholder="Sin prioridad"
        />
      </div>
    </fieldset>
  )
}
