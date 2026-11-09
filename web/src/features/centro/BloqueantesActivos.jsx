import { Button, Card, EmptyState, ListItem, ListaItems } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { useEscalarBloqueo, useNotificarItemGuardado } from '../../hooks/useAlertas'
import { useGuardarItem } from '../../hooks/useItems'
import { formatoFechaHora, horasDesde } from '../../lib/fechas'
import { tonoSeveridad } from '../../lib/tonos'

function BloqueanteItem({ bloqueante, alEscalar, alResolver, ocupado }) {
  const { id, codigo, cliente, actividad, titulo, motivo, responsable, severidad, abierto_en, escalado_en } = bloqueante
  return (
    <div>
      <ListItem
        alerta
        id={`${codigo} · ${cliente ?? '-'} · ${actividad ?? '-'}`}
        titulo={titulo}
        cuerpo={motivo}
        chips={[[severidad, tonoSeveridad(severidad)]]}
        meta={[
          <>
            Responsable: <b>{responsable ?? 'Sin asignar'}</b>
          </>,
          <>
            Bloqueado hace <b>{horasDesde(abierto_en)} h</b>
          </>,
          escalado_en ? `Escalado ${formatoFechaHora(escalado_en)}` : 'Sin escalar',
        ]}
      />
      <div className="mt-2 flex gap-2">
        <Button full icon="campaign" disabled={ocupado} onClick={() => alEscalar(id)}>
          Escalar
        </Button>
        <Button full icon="check_circle" disabled={ocupado} onClick={() => alResolver(bloqueante)}>
          Resolver
        </Button>
      </div>
    </div>
  )
}

export function BloqueantesActivos({ bloqueantes }) {
  const notificar = useToast()
  const escalar = useEscalarBloqueo()
  const guardarItem = useGuardarItem()
  const notificarGuardado = useNotificarItemGuardado()
  const ocupado = escalar.isPending || guardarItem.isPending || notificarGuardado.isPending

  const alEscalar = async (id) => {
    try {
      const { ok, mensaje } = await escalar.mutateAsync(id)
      notificar(mensaje, ok ? 'exito' : 'aviso')
    } catch (error) {
      notificar(error.message, 'error')
    }
  }

  const alResolver = async ({ item_id }) => {
    try {
      const resultado = await guardarItem.mutateAsync({ datos: { bloqueado: false }, id: item_id })
      const { mensaje } = await notificarGuardado.mutateAsync(resultado)
      notificar(mensaje || 'Bloqueo resuelto.')
    } catch (error) {
      notificar(error.message, 'error')
    }
  }

  return (
    <Card title="Bloqueantes activos" icon="report" subtitle="Escala a stakeholders o márcalo como resuelto.">
      {bloqueantes.length === 0 && <EmptyState>No hay bloqueos abiertos.</EmptyState>}
      <ListaItems className="gap-3">
        {bloqueantes.map((bloqueante) => (
          <BloqueanteItem
            key={bloqueante.id}
            bloqueante={bloqueante}
            alEscalar={alEscalar}
            alResolver={alResolver}
            ocupado={ocupado}
          />
        ))}
      </ListaItems>
    </Card>
  )
}
