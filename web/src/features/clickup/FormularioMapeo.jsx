import { useState } from 'react'
import { conAviso } from '../../lib/conAviso'
import { ESTADOS } from '../../lib/constantes'
import { useToast } from '../../context/ToastContext'
import { Button } from '../../components/ui'
import { aLista, aValorMapeo } from './mapeoEstados'
import { SelectorEstados } from './SelectorEstados'

export function FormularioMapeo({ inicial, disponibles, ocupado, alGuardar, alUsarGeneral }) {
  const toast = useToast()
  const [mapeo, setMapeo] = useState(inicial)
  const completo = ESTADOS.every((estado) => aLista(mapeo[estado]).length > 0)
  const cambiar = (estado) => (lista) => setMapeo((actual) => ({ ...actual, [estado]: aValorMapeo(lista) }))

  const enviar = conAviso(toast, async (evento) => {
    evento.preventDefault()
    await alGuardar(mapeo)
  })

  return (
    <form onSubmit={enviar} className="space-y-3">
      <p className="text-xs text-ink-muted">
        Cada estado de la app admite uno o varios estados de ClickUp. El primero es el que se envía a ClickUp; los demás
        solo se aceptan cuando ClickUp avisa de un cambio.
      </p>
      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        {ESTADOS.map((estado) => (
          <SelectorEstados
            key={estado}
            estado={estado}
            disponibles={disponibles}
            lista={aLista(mapeo[estado])}
            alCambiar={cambiar(estado)}
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
