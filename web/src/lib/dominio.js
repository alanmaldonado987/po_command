import { CERRADOS, ESTADO_PRUEBAS } from './constantes'
import { hoyIso, sumarDias } from './fechas'
import { agrupar, porcentaje } from './texto'

export const estaAbierto = (item) => !CERRADOS.includes(item.estado)
export const estadoVisible = (item) => (item.bloqueado ? 'Bloqueado' : item.estado)
export const itemsAtrasados = (items) => items.filter((item) => item.atrasado)

export function itemsPorVencer(items, dias, hoy = hoyIso()) {
  const tope = sumarDias(hoy, dias)
  return items
    .filter((item) => estaAbierto(item) && item.fecha_compromiso && item.fecha_compromiso <= tope)
    .sort((a, b) => a.fecha_compromiso.localeCompare(b.fecha_compromiso))
}

export function cargaPorResponsable(items) {
  const carga = {}
  items.filter(estaAbierto).forEach((item) => {
    const nombre = item.responsable ?? 'Sin asignar'
    carga[nombre] ??= { abiertos: 0, atrasados: 0 }
    carga[nombre].abiertos += 1
    carga[nombre].atrasados += item.atrasado ? 1 : 0
  })
  return carga
}

export function conteoPorEstado(items) {
  const conteo = { total: items.length, terminados: 0, pruebas: 0, enCurso: 0, noIniciados: 0, suspendidos: 0 }
  items.forEach(({ estado }) => {
    if (estado === 'Terminado') conteo.terminados += 1
    else if (estado === ESTADO_PRUEBAS) conteo.pruebas += 1
    else if (estado === 'En curso') conteo.enCurso += 1
    else if (estado === 'No iniciado') conteo.noIniciados += 1
    else conteo.suspendidos += 1
  })
  return conteo
}

export function avancePorCliente(items) {
  return Object.entries(agrupar(items, (item) => item.cliente ?? 'Sin cliente'))
    .map(([cliente, lista]) => ({ cliente, ...conteoPorEstado(lista) }))
    .sort((a, b) => a.cliente.localeCompare(b.cliente, 'es'))
}

export const porcentajeAvance = (items) => porcentaje(items.filter((i) => i.estado === 'Terminado').length, items.length)

export const etiquetaItem = (item) =>
  `${item.codigo} · ${item.actividad ?? '-'} · ${item.titulo} (${item.alcance || '-'})`
