import { TIPOS_NOTA } from '../../lib/constantes'
import { SelectField, TextAreaField, Toggle } from '../../components/ui'

export function SeccionConsideraciones({ valores, cambiar }) {
  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-ink">Consideraciones</legend>
        <div className="grid grid-cols-[1fr_3fr] gap-3 max-sm:grid-cols-1">
          <SelectField label="Tipo de nota" opciones={TIPOS_NOTA} value={valores.tipoNota} onChange={cambiar('tipoNota')} />
          <TextAreaField
            label="Nueva nota para la bitácora"
            filas={2}
            value={valores.nota}
            onChange={cambiar('nota')}
            placeholder="Ej.: Se amplía fecha de pruebas por pendiente del cliente. Queda con la fecha de hoy."
          />
        </div>
      </fieldset>
      <hr className="border-line" />
      <div className="space-y-3">
        <Toggle label="Ítem bloqueado" checked={valores.bloqueado} onChange={cambiar('bloqueado')} />
        <TextAreaField
          label="Motivo del bloqueo"
          filas={2}
          value={valores.motivo_bloqueo}
          onChange={cambiar('motivo_bloqueo')}
          placeholder="Qué lo bloquea y de quién depende (va en el correo de alerta)"
        />
      </div>
    </>
  )
}
