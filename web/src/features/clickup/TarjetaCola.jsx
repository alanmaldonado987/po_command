import { useMemo, useState } from 'react'
import { useColaClickUp } from '../../hooks/useClickUp'
import { useItems } from '../../hooks/useItems'
import { FILTROS_COLA, LIMITE_PAGINA_COLA } from '../../lib/colaClickUp'
import { Button, Card, EmptyState, ErrorState, ListaItems, LoadingState, SegmentedControl } from '../../components/ui'
import { FilaCola } from './FilaCola'

const VACIOS = {
  todos: 'Aún no se ha enviado nada a ClickUp.',
  pendientes: 'No hay envíos pendientes.',
  errores: 'No hay envíos con error.',
  enviados: 'Aún no hay envíos completados.',
}

const opcionesDe = (estado) =>
  Object.entries(FILTROS_COLA).map(([value, { etiqueta }]) => {
    const cantidad = { pendientes: estado.pendientes, errores: estado.con_error }[value]
    return { value, label: cantidad === undefined ? etiqueta : `${etiqueta} · ${cantidad}` }
  })

export function TarjetaCola({ estado, filtro, onFiltro }) {
  const [limite, setLimite] = useState(LIMITE_PAGINA_COLA)
  const { data, isLoading, error } = useColaClickUp(filtro, limite)
  const { data: items = [] } = useItems()
  const itemsPorId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const filas = data?.filas ?? []

  const cambiarFiltro = (nuevo) => {
    setLimite(LIMITE_PAGINA_COLA)
    onFiltro(nuevo)
  }

  return (
    <Card
      title="Cola de envíos"
      icon="history"
      subtitle="Lo que la app envía a ClickUp: qué está pendiente, qué salió bien y por qué falló lo que falló."
    >
      <SegmentedControl opciones={opcionesDe(estado)} value={filtro} onChange={cambiarFiltro} />
      <div aria-live="polite" className="flex flex-col gap-2.5">
        {isLoading && <LoadingState />}
        {error && <ErrorState error={error} />}
        {!isLoading && !error && filas.length === 0 && <EmptyState>{VACIOS[filtro]}</EmptyState>}
        <ListaItems>
          {filas.map((fila) => (
            <FilaCola key={fila.id} fila={fila} item={itemsPorId.get(fila.item_id)} />
          ))}
        </ListaItems>
      </div>
      {data?.hayMas && (
        <Button variant="secondary" icon="expand_more" onClick={() => setLimite((actual) => actual + LIMITE_PAGINA_COLA)}>
          Ver más
        </Button>
      )}
    </Card>
  )
}
