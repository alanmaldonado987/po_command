import { useState } from 'react'
import { EmptyState, ErrorState, Hero, LoadingState } from '../components/ui'
import { AgendaCeremonias } from '../features/ceremonias/AgendaCeremonias'
import { DetalleCeremonia } from '../features/ceremonias/DetalleCeremonia'
import { EditorAcuerdos } from '../features/ceremonias/EditorAcuerdos'
import { FormularioCeremonia } from '../features/ceremonias/FormularioCeremonia'
import { useAcuerdos, useCeremonias } from '../hooks/useCeremonias'
import { useCatalogo } from '../hooks/useCatalogos'
import { useItems } from '../hooks/useItems'
import { usePersonas } from '../hooks/usePersonas'

const NUEVA = 'nueva'

export default function Ceremonias() {
  const ceremonias = useCeremonias()
  const acuerdos = useAcuerdos()
  const personas = usePersonas()
  const clientes = useCatalogo('cliente')
  const items = useItems()
  const [seleccion, setSeleccion] = useState(null)

  const consultas = [ceremonias, acuerdos, personas, clientes, items]
  const error = consultas.find((consulta) => consulta.error)?.error
  if (error) return <ErrorState error={error} />
  if (consultas.some((consulta) => !consulta.data)) return <LoadingState />

  const elegida = seleccion === NUEVA ? null : ceremonias.data.find((c) => c.id === seleccion)
  const cerrar = () => setSeleccion(null)

  return (
    <>
      <Hero
        kicker="DEMOS & CEREMONIAS"
        titulo="Agenda de seguimiento"
        subtitulo="Cada ceremonia envía su invitación y recordatorios. Los acuerdos quedan como compromisos con fecha y alerta."
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <AgendaCeremonias
            ceremonias={ceremonias.data}
            seleccionId={seleccion}
            alElegir={setSeleccion}
            alAgendar={() => setSeleccion(NUEVA)}
          />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-3">
          {seleccion === null && <EmptyState>Elige una ceremonia para ver invitados, enviar la invitación o editarla.</EmptyState>}
          {elegida && <DetalleCeremonia ceremonia={elegida} items={items.data} alEliminar={cerrar} />}
          {seleccion !== null && (elegida || seleccion === NUEVA) && (
            <FormularioCeremonia
              key={seleccion}
              ceremonia={elegida}
              clientes={clientes.data}
              alGuardar={setSeleccion}
              alCerrar={cerrar}
            />
          )}
        </div>
      </div>
      <EditorAcuerdos
        key={acuerdos.data.map((a) => a.id).join()}
        acuerdos={acuerdos.data}
        personas={personas.data}
      />
    </>
  )
}
