import { useState } from 'react'
import { EditorItem } from '../features/backlog/EditorItem'
import { FiltrosBacklog } from '../features/backlog/FiltrosBacklog'
import { TablaBacklog } from '../features/backlog/TablaBacklog'
import { useFiltrosBacklog } from '../features/backlog/useFiltrosBacklog'
import { useItems, useTodasLasNotas } from '../hooks/useItems'
import { ErrorState, Hero, LoadingState } from '../components/ui'

const SIN_EDICION = { modo: null, id: null, baseId: null }

export default function Backlog() {
  const { data: items = [], isLoading, error } = useItems()
  const { data: notas = [] } = useTodasLasNotas()
  const { filtros, cambiar, filtrados } = useFiltrosBacklog(items, notas)
  const [edicion, setEdicion] = useState(SIN_EDICION)

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />

  const itemEnEdicion = edicion.modo === 'editar' ? items.find((item) => item.id === edicion.id) : null
  const itemBase = edicion.baseId ? items.find((item) => item.id === edicion.baseId) : null
  const editorVisible = edicion.modo === 'nuevo' || Boolean(itemEnEdicion)

  const editar = (id) => setEdicion(id ? { modo: 'editar', id, baseId: null } : SIN_EDICION)

  return (
    <>
      <Hero
        kicker="BACKLOG · PLAN DE TRABAJO"
        titulo="Ítems del backlog"
        subtitulo="Cada ítem es una fila del plan: Cliente → Actividad → Módulo → Funcionalidad, con sus fechas planificadas y ejecutadas. Bloquear o reprogramar un ítem avisa a su equipo."
      />
      <FiltrosBacklog filtros={filtros} cambiar={cambiar} items={items} alNuevo={() => setEdicion({ modo: 'nuevo', id: null, baseId: null })} />
      <TablaBacklog items={filtrados} seleccionado={itemEnEdicion?.id} alSeleccionar={editar} />
      {editorVisible && (
        <EditorItem
          item={itemEnEdicion}
          base={itemBase}
          alGuardar={editar}
          alCerrar={() => setEdicion(SIN_EDICION)}
          alDuplicar={() => setEdicion({ modo: 'nuevo', id: null, baseId: itemEnEdicion.id })}
        />
      )}
    </>
  )
}
