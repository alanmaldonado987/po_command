import { useToast } from '../../context/ToastContext'
import { conAviso } from '../../lib/conAviso'
import { formatoFecha } from '../../lib/fechas'
import { tonoEstado } from '../../lib/tonos'
import { useEliminarNota, useNotas } from '../../hooks/useItems'
import { Button, Card, EmptyState, ListItem, ListaItems } from '../../components/ui'

export function PanelBitacora({ itemId }) {
  const { data: notas = [], isLoading } = useNotas(itemId)
  const eliminar = useEliminarNota()
  const notificar = useToast()
  const eliminarNota = conAviso(notificar, (id) => eliminar.mutateAsync(id))

  return (
    <Card title="Bitácora" icon="history_edu" subtitle="Consideraciones, reprogramaciones y bloqueos del ítem.">
      {!isLoading && notas.length === 0 && <EmptyState>Sin notas todavía.</EmptyState>}
      <ListaItems>
        {notas.map((nota) => (
          <div key={nota.id} className="flex items-start gap-2">
            <ListItem
              className="flex-1"
              id={`${formatoFecha(nota.fecha)} · ${nota.autor}`}
              cuerpo={nota.texto}
              chips={[[nota.tipo, tonoEstado(nota.tipo)]]}
            />
            <Button
              variant="ghost"
              size="sm"
              icon="delete"
              title="Eliminar nota"
              aria-label="Eliminar nota"
              onClick={() => eliminarNota(nota.id)}
            />
          </div>
        ))}
      </ListaItems>
    </Card>
  )
}
