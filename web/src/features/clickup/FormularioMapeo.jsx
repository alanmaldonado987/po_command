import { useState } from 'react'
import { conAviso } from '../../lib/conAviso'
import { ESTADOS } from '../../lib/constantes'
import { useToast } from '../../context/ToastContext'
import { Button, SelectField } from '../../components/ui'

export function FormularioMapeo({ inicial, disponibles, ocupado, alGuardar, alUsarGeneral }) {
  const toast = useToast()
  const [mapeo, setMapeo] = useState(inicial)
  const completo = ESTADOS.every((estado) => mapeo[estado])
  const opcionesDe = (estado) => [...new Set([...disponibles, mapeo[estado]].filter(Boolean))]

  const enviar = conAviso(toast, async (evento) => {
    evento.preventDefault()
    await alGuardar(mapeo)
  })

  return (
    <form onSubmit={enviar} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        {ESTADOS.map((estado) => (
          <SelectField
            key={estado}
            label={estado}
            placeholder="Elige el estado de ClickUp"
            opciones={opcionesDe(estado)}
            value={mapeo[estado] ?? null}
            onChange={(valor) => setMapeo((actual) => ({ ...actual, [estado]: valor ?? '' }))}
          />
        ))}
      </div>
      {!completo && <p className="text-xs text-ink-muted">Asigna un estado de ClickUp a cada estado de la app para poder guardar.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" icon="save" disabled={!completo} loading={ocupado}>
          Guardar mapeo
        </Button>
        {alUsarGeneral && (
          <Button icon="undo" loading={ocupado} onClick={conAviso(toast, alUsarGeneral)}>
            Usar el mapeo general
          </Button>
        )}
      </div>
    </form>
  )
}
