export const ORIGEN_DESTINO = {
  propio: 'propio',
  tablero: 'tablero',
  cliente: 'cliente',
  defecto: 'defecto',
}

const coincide = (destino, tableroId, clienteId) =>
  (destino.tablero_id ?? null) === tableroId && (destino.cliente_id ?? null) === clienteId

function candidatos(tablero, cliente) {
  const lista = []
  if (tablero !== null && cliente !== null) lista.push([tablero, cliente, ORIGEN_DESTINO.propio])
  if (tablero !== null) lista.push([tablero, null, cliente === null ? ORIGEN_DESTINO.propio : ORIGEN_DESTINO.tablero])
  if (cliente !== null) lista.push([null, cliente, tablero === null ? ORIGEN_DESTINO.propio : ORIGEN_DESTINO.cliente])
  lista.push([null, null, tablero === null && cliente === null ? ORIGEN_DESTINO.propio : ORIGEN_DESTINO.defecto])
  return lista
}

export function resolverDestino(destinos, tableroId = null, clienteId = null) {
  for (const [tablero, cliente, origen] of candidatos(tableroId ?? null, clienteId ?? null)) {
    const destino = destinos.find((fila) => coincide(fila, tablero, cliente))
    if (destino) return { destino, origen }
  }
  return { destino: null, origen: null }
}

export const destinoPropio = (destinos, tableroId, clienteId) =>
  destinos.find((fila) => coincide(fila, tableroId ?? null, clienteId ?? null)) ?? null

const TEXTO_HERENCIA = {
  [ORIGEN_DESTINO.tablero]: 'Usa el destino del tablero',
  [ORIGEN_DESTINO.cliente]: 'Usa el destino del cliente',
  [ORIGEN_DESTINO.defecto]: 'Usa el destino por defecto',
}

export function describirHerencia({ destino, origen }) {
  if (!destino) return { tono: 'rojo', texto: 'Sin destino' }
  if (origen === ORIGEN_DESTINO.propio) return null
  return { tono: 'azul', texto: TEXTO_HERENCIA[origen] }
}

export const usoDeTablero = (tableroId, personas, destinos) => ({
  personas: personas.filter((persona) => persona.tablero_id === tableroId).length,
  destinos: destinos.filter((destino) => destino.tablero_id === tableroId).length,
})
