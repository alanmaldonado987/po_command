import { estaAbierto } from '../../lib/dominio'

export function cargaPorPersona(items) {
  const carga = {}
  items.filter(estaAbierto).forEach((item) => {
    if (!item.responsable_id) return
    carga[item.responsable_id] ??= { abiertos: 0, atrasados: 0 }
    carga[item.responsable_id].abiertos += 1
    carga[item.responsable_id].atrasados += item.atrasado ? 1 : 0
  })
  return carga
}

export const maximoAbiertos = (carga) => Math.max(1, ...Object.values(carga).map((c) => c.abiertos))
