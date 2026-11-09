import { useState } from 'react'
import { conAviso } from '../../lib/conAviso'
import { useToast } from '../../context/ToastContext'
import {
  useActualizarTablero,
  useCrearTablero,
  useDestinosClickUp,
  useEliminarTablero,
  useTablerosClickUp,
} from '../../hooks/useClickUp'
import { usePersonas } from '../../hooks/usePersonas'
import { Button, Card, EmptyState, ErrorState, LoadingState, TextField } from '../../components/ui'
import { usoDeTablero } from './destinos'
import { FilaTablero } from './FilaTablero'

export function TarjetaTableros() {
  const toast = useToast()
  const { data: tableros = [], isLoading, error } = useTablerosClickUp()
  const { data: personas = [] } = usePersonas()
  const { data: destinos = [] } = useDestinosClickUp()
  const crear = useCrearTablero()
  const actualizar = useActualizarTablero()
  const eliminar = useEliminarTablero()
  const [nombre, setNombre] = useState('')

  const agregar = conAviso(toast, async (evento) => {
    evento.preventDefault()
    const limpio = nombre.trim()
    if (!limpio) return
    await crear.mutateAsync({ nombre: limpio })
    setNombre('')
    toast(`Tablero «${limpio}» creado.`)
  })

  const renombrar = conAviso(toast, async (tablero, nuevoNombre) => {
    await actualizar.mutateAsync({ id: tablero.id, nombre: nuevoNombre })
    toast(`Tablero renombrado a «${nuevoNombre}».`)
  })

  const borrar = conAviso(toast, async (tablero) => {
    await eliminar.mutateAsync(tablero.id)
    toast(`Tablero «${tablero.nombre}» eliminado.`)
  })

  return (
    <Card
      title="Tableros"
      icon="dashboard"
      subtitle="Un tablero agrupa a las personas que trabajan en la misma lista de ClickUp (por ejemplo Desarrollo y Analítica). El tablero de cada ítem lo decide su responsable."
    >
      <form onSubmit={agregar} className="flex flex-wrap items-end gap-3">
        <TextField className="min-w-[220px] flex-1" label="Nuevo tablero" placeholder="Desarrollo, Analítica…" value={nombre} onChange={setNombre} />
        <Button type="submit" variant="primary" icon="add" disabled={!nombre.trim()} loading={crear.isPending}>
          Agregar tablero
        </Button>
      </form>
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {!isLoading && !error && tableros.length === 0 && (
        <EmptyState>Aún no hay tableros. Sin tableros todos los ítems usan el destino por defecto.</EmptyState>
      )}
      <div className="space-y-2">
        {tableros.map((tablero) => (
          <FilaTablero
            key={tablero.id}
            tablero={tablero}
            uso={usoDeTablero(tablero.id, personas, destinos)}
            ocupado={actualizar.isPending || eliminar.isPending}
            alRenombrar={(nuevoNombre) => renombrar(tablero, nuevoNombre)}
            alEliminar={() => borrar(tablero)}
          />
        ))}
      </div>
    </Card>
  )
}
