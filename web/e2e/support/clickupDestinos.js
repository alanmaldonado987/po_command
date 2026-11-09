const CERRADOS = ['Terminado', 'Suspendido']

export const estaAbierto = (item) => !item.eliminado_en && !CERRADOS.includes(item.estado)

export const tableroDeItem = (estado, item) =>
  estado.persona.find((persona) => persona.id === item.responsable_id)?.tablero_id ?? null

function candidatos(tablero, cliente) {
  const lista = []
  if (tablero !== null && cliente !== null) lista.push([tablero, cliente])
  if (tablero !== null) lista.push([tablero, null])
  if (cliente !== null) lista.push([null, cliente])
  lista.push([null, null])
  return lista
}

export function resolverDestino(estado, tableroId, clienteId) {
  for (const [tablero, cliente] of candidatos(tableroId ?? null, clienteId ?? null)) {
    const destino = estado.clickup_destino.find(
      (fila) => (fila.tablero_id ?? null) === tablero && (fila.cliente_id ?? null) === cliente,
    )
    if (destino) return destino
  }
  return null
}

export const destinoDeItem = (estado, item) => resolverDestino(estado, tableroDeItem(estado, item), item.cliente_id)

export const itemsSinDestino = (estado) =>
  estado.item.filter((item) => estaAbierto(item) && !destinoDeItem(estado, item))

export const itemsAbiertosVinculadosDe = (estado, personaId) =>
  estado.item.filter((item) => item.responsable_id === personaId && estaAbierto(item) && item.clickup_task_id)
