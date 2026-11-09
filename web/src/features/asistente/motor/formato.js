import { hoyIso } from '../../../lib/fechas'
import { estaAbierto } from '../../../lib/dominio'

export const SIN_ACCIONES = []

export const contexto = (datos) => ({ hoy: datos.hoy ?? hoyIso(), ahora: datos.ahora ?? Date.now() })

export const abiertos = (datos) => datos.items.filter(estaAbierto)

export const horasAbierto = (desde, ahora) => Math.floor((ahora - new Date(desde).getTime()) / 3_600_000)

export const lineaItem = (item, extra = '') =>
  `**${item.codigo}** ${item.cliente ?? '-'} · ${item.actividad ?? '-'} · ${item.titulo} (${item.alcance || '-'})` +
  ` — ${item.responsable ?? 'sin responsable'}${extra}`

export const porAtrasoDescendente = (a, b) => b.atraso_dias - a.atraso_dias

export const respuesta = (texto, acciones = SIN_ACCIONES) => ({ texto, acciones })

export const accionEscalar = (bloqueante, etiqueta) => ({ tipo: 'escalar', id: bloqueante.id, etiqueta })

export const accionRecordar = (items, etiqueta) => ({ tipo: 'recordar', ids: items.map((i) => i.id), etiqueta })
