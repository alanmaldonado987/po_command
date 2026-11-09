import { conAviso } from '../../lib/conAviso'
import { useToast } from '../../context/ToastContext'
import { useEliminarDestino, useGuardarDestino } from '../../hooks/useClickUp'
import { Expander } from '../../components/ui'
import { describirHerencia, destinoPropio, resolverDestino } from './destinos'
import { FilaDestino } from './FilaDestino'

export function SeccionDestinos({ titulo, icono, tablero, clientes, destinos, espacios }) {
  const toast = useToast()
  const guardar = useGuardarDestino()
  const quitar = useEliminarDestino()
  const tableroId = tablero?.id ?? null
  const prefijo = tablero ? `${tablero.nombre} · ` : ''

  const guardarDestino = (clienteId, nombre) =>
    conAviso(toast, async (lista) => {
      await guardar.mutateAsync({
        id: destinoPropio(destinos, tableroId, clienteId)?.id ?? null,
        tableroId,
        clienteId,
        listaId: lista.id,
        listaNombre: lista.ruta ?? lista.nombre,
      })
      toast(`Destino de ${nombre} guardado.`)
    })

  const quitarDestino = (clienteId, nombre) =>
    conAviso(toast, async () => {
      await quitar.mutateAsync(destinoPropio(destinos, tableroId, clienteId).id)
      toast(`Destino de ${nombre} quitado.`)
    })

  const fila = (clienteId, nombreCorto, nombre) => {
    const resolucion = resolverDestino(destinos, tableroId, clienteId)
    const esRaiz = tableroId === null && clienteId === null
    return (
      <FilaDestino
        key={clienteId ?? 'todos'}
        titulo={nombre}
        destino={destinoPropio(destinos, tableroId, clienteId)}
        heredado={resolucion.origen === 'propio' ? null : resolucion.destino}
        aviso={esRaiz ? null : describirHerencia(resolucion)}
        espacios={espacios}
        ocupado={guardar.isPending}
        alGuardar={guardarDestino(clienteId, nombre)}
        alQuitar={quitarDestino(clienteId, nombre)}
      />
    )
  }

  return (
    <Expander titulo={titulo} icono={icono} abierto>
      <div className="space-y-3">
        {fila(null, 'todos', tablero ? `${prefijo}Todos los clientes` : 'Destino por defecto')}
        {clientes.map((cliente) => fila(cliente.id, cliente.nombre, `${prefijo}${cliente.nombre}`))}
      </div>
    </Expander>
  )
}
