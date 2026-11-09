import { useState } from 'react'
import { conAviso } from '../../lib/conAviso'
import { useToast } from '../../context/ToastContext'
import {
  useActualizarTablero,
  useDestinosClickUp,
  useGuardarConfigClickUp,
  useJerarquiaClickUp,
  useTablerosClickUp,
} from '../../hooks/useClickUp'
import { Alert, Card, SegmentedControl } from '../../components/ui'
import { estadosDeDestinos } from './jerarquia'
import { FormularioMapeo } from './FormularioMapeo'

const GENERAL = 'general'

export function TarjetaEstados({ estado }) {
  const toast = useToast()
  const { data: jerarquia } = useJerarquiaClickUp(estado.equipo?.id)
  const { data: destinos = [] } = useDestinosClickUp()
  const { data: tableros = [] } = useTablerosClickUp()
  const guardarGeneral = useGuardarConfigClickUp()
  const actualizarTablero = useActualizarTablero()
  const [ambito, setAmbito] = useState(GENERAL)

  const tablero = tableros.find((candidato) => candidato.id === ambito) ?? null
  const destinosDelAmbito = tablero ? destinos.filter((destino) => destino.tablero_id === tablero.id) : destinos
  const disponibles = estadosDeDestinos(jerarquia?.espacios ?? [], destinosDelAmbito)
  const general = estado.mapeo_estados ?? {}
  const propio = tablero?.mapeo_estados ?? null
  const inicial = tablero ? (propio ?? general) : general
  const huella = JSON.stringify([ambito, inicial])

  const guardar = conAviso(toast, async (mapeo) => {
    if (tablero) await actualizarTablero.mutateAsync({ id: tablero.id, mapeoEstados: mapeo })
    else await guardarGeneral.mutateAsync({ mapeo_estados: mapeo })
    toast(tablero ? `Mapeo del tablero ${tablero.nombre} guardado.` : 'Mapeo de estados guardado.')
  })

  const usarGeneral = async () => {
    await actualizarTablero.mutateAsync({ id: tablero.id, mapeoEstados: null })
    toast(`El tablero ${tablero.nombre} usa ahora el mapeo general.`)
  }

  return (
    <Card
      title="Estados"
      icon="swap_horiz"
      subtitle="Qué estado de ClickUp corresponde a cada estado de la app, en los dos sentidos. Cada tablero puede tener su propio mapeo."
    >
      {!estado.equipo && <Alert tono="info">Elige un equipo en la tarjeta de conexión para leer los estados de tus listas.</Alert>}
      {estado.equipo && (
        <>
          {tableros.length > 0 && (
            <SegmentedControl
              label="Mapeo de"
              opciones={[{ value: GENERAL, label: 'General' }, ...tableros.map(({ id, nombre }) => ({ value: id, label: nombre }))]}
              value={ambito}
              onChange={setAmbito}
            />
          )}
          {tablero && !propio && (
            <Alert tono="info">
              Este tablero usa el mapeo general. Si guardas cambios aquí, el tablero tendrá su propio mapeo.
            </Alert>
          )}
          <FormularioMapeo
            key={huella}
            inicial={inicial}
            disponibles={disponibles}
            ocupado={guardarGeneral.isPending || actualizarTablero.isPending}
            alGuardar={guardar}
            alUsarGeneral={tablero && propio ? usarGeneral : null}
          />
        </>
      )}
    </Card>
  )
}
