import { diasEntre, hoyIso } from './tiempo.js'

const CERRADOS = ['Terminado', 'Suspendido']

const nombreDe = (tabla, id) => tabla.find((fila) => fila.id === id)?.nombre ?? null

function atrasoDias(item, compromiso, entrega) {
  if (!compromiso) return 0
  if (item.estado === 'Terminado') return Math.max(diasEntre(compromiso, entrega ?? compromiso), 0)
  if (item.estado === 'Suspendido') return 0
  return Math.max(diasEntre(compromiso, hoyIso()), 0)
}

export function vistaItem(estado) {
  return estado.item
    .filter((item) => !item.eliminado_en)
    .map((item) => {
      const compromiso = item.plan_pruebas_fin ?? item.plan_fin ?? null
      const entrega = item.real_pruebas_fin ?? item.real_fin ?? null
      const modulo = nombreDe(estado.modulo, item.modulo_id)
      const persona = estado.persona.find((p) => p.id === item.responsable_id)
      const tableroId = persona?.tablero_id ?? null
      const atraso = atrasoDias(item, compromiso, entrega)
      return {
        ...item,
        fecha_compromiso: compromiso,
        fecha_entrega: entrega,
        atraso_dias: atraso,
        titulo: item.funcionalidad.toLowerCase() === 'completo' ? `${modulo ?? ''} · completo` : item.funcionalidad,
        atrasado: !CERRADOS.includes(item.estado) && atraso > 0,
        producto: nombreDe(estado.producto, item.producto_id),
        cliente: nombreDe(estado.cliente, item.cliente_id),
        actividad: nombreDe(estado.actividad, item.actividad_id),
        modulo,
        responsable: persona?.nombre ?? null,
        responsable_correo: persona?.correo ?? null,
        tablero_id: tableroId,
        tablero: nombreDe(estado.clickup_tablero, tableroId),
      }
    })
}

export function vistaBloqueanteAbierto(estado) {
  const items = vistaItem(estado)
  return estado.bloqueante
    .filter((b) => !b.resuelto_en)
    .flatMap((b) => {
      const item = items.find((i) => i.id === b.item_id)
      if (!item) return []
      return [{
        id: b.id, item_id: b.item_id, motivo: b.motivo, severidad: b.severidad, abierto_en: b.abierto_en, escalado_en: b.escalado_en,
        codigo: item.codigo, titulo: item.titulo, cliente_id: item.cliente_id, cliente: item.cliente, actividad: item.actividad,
        modulo: item.modulo, responsable: item.responsable, fecha_compromiso: item.fecha_compromiso,
      }]
    })
}

export const vistaCeremonia = (estado) =>
  estado.ceremonia.map((c) => ({ ...c, cliente: nombreDe(estado.cliente, c.cliente_id) }))

export const vistaAcuerdo = (estado) =>
  estado.acuerdo.map((a) => {
    const persona = estado.persona.find((p) => p.id === a.responsable_id)
    return { ...a, responsable: persona?.nombre ?? null, responsable_correo: persona?.correo ?? null }
  })

export const vistaPersona = (estado) =>
  estado.persona.map((p) => {
    const ids = estado.persona_cliente.filter((pc) => pc.persona_id === p.id).map((pc) => pc.cliente_id)
    const nombres = ids.map((id) => nombreDe(estado.cliente, id)).filter(Boolean).sort((a, b) => a.localeCompare(b))
    return {
      ...p,
      cliente_ids: ids,
      clientes: nombres.join(', '),
      tablero_id: p.tablero_id ?? null,
      tablero: nombreDe(estado.clickup_tablero, p.tablero_id ?? null),
    }
  })

export const VISTAS = {
  v_item: vistaItem,
  v_bloqueante_abierto: vistaBloqueanteAbierto,
  v_ceremonia: vistaCeremonia,
  v_acuerdo: vistaAcuerdo,
  v_persona: vistaPersona,
}
