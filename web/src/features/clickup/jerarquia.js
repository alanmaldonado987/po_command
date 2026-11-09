export const SIN_CARPETA = 'sin-carpeta'

const conRuta = (lista, ...tramos) => ({ ...lista, ruta: [...tramos, lista.nombre].join(' / ') })

export function aplanarListas(espacios = []) {
  return espacios.flatMap((espacio) => [
    ...espacio.listas.map((lista) => conRuta(lista, espacio.nombre)),
    ...espacio.carpetas.flatMap((carpeta) => carpeta.listas.map((lista) => conRuta(lista, espacio.nombre, carpeta.nombre))),
  ])
}

export const buscarLista = (espacios, listaId) => aplanarListas(espacios).find((lista) => lista.id === listaId) ?? null

export function listasDe(espacio, carpetaId) {
  if (!espacio) return []
  if (carpetaId === SIN_CARPETA) return espacio.listas
  return espacio.carpetas.find((carpeta) => carpeta.id === carpetaId)?.listas ?? []
}

export function opcionesDeCarpeta(espacio) {
  if (!espacio) return []
  const carpetas = espacio.carpetas.map((carpeta) => ({ value: carpeta.id, label: carpeta.nombre }))
  return espacio.listas.length ? [{ value: SIN_CARPETA, label: 'Sin carpeta' }, ...carpetas] : carpetas
}

export function estadosDeDestinos(espacios, destinos) {
  const listas = aplanarListas(espacios)
  const elegidas = destinos.map((destino) => listas.find((lista) => lista.id === destino.lista_id)).filter(Boolean)
  const origen = elegidas.length ? elegidas : listas
  return [...new Set(origen.flatMap((lista) => lista.estados))]
}
