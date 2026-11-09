import { useDestinatarios } from '../../hooks/useAlertas'
import { Alert, Avatar, Card } from '../../components/ui'

export function PanelDestinatarios({ itemId }) {
  const { data: destinatarios = [], isLoading } = useDestinatarios({ regla_codigo: 'BLOQUEO_NUEVO', item_id: itemId })

  return (
    <Card title="Si se bloquea, se avisa a" icon="forward_to_inbox">
      {destinatarios.map((persona) => (
        <div key={persona.correo} className="flex items-center gap-3 py-1.5">
          <Avatar nombre={persona.nombre} tono="verde" />
          <div className="min-w-0">
            <div className="text-sm font-bold text-ink">{persona.nombre}</div>
            <div className="truncate text-xs text-ink-muted">
              {persona.rol} · {persona.correo}
            </div>
          </div>
        </div>
      ))}
      {!isLoading && destinatarios.length === 0 && (
        <Alert tono="aviso">No hay destinatarios con correo válido. Revisa Equipo & Stakeholders.</Alert>
      )}
    </Card>
  )
}
