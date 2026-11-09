import { CERRADOS, ESTADOS } from '../../lib/constantes'
import { estaAbierto } from '../../lib/dominio'
import { agrupar, porcentaje } from '../../lib/texto'

const MS_HORA = 3_600_000

export const ORDEN_ESTADOS = ['Terminado', 'Terminado, en etapa de pruebas', 'En curso', 'No iniciado', 'Suspendido']

export function calcularKpis({ items, notas, bloqueantes }) {
  const ids = new Set(items.map((item) => item.id))
  const terminados = items.filter((item) => item.estado === 'Terminado')
  const conFechas = terminados.filter((item) => item.fecha_compromiso && item.fecha_entrega)
  const aTiempo = conFechas.filter((item) => item.atraso_dias === 0).length
  const atrasados = items.filter((item) => item.atrasado)
  const horasResolucion = bloqueantes
    .filter((bloqueo) => ids.has(bloqueo.item_id) && bloqueo.resuelto_en)
    .map((bloqueo) => (new Date(bloqueo.resuelto_en) - new Date(bloqueo.abierto_en)) / MS_HORA)

  return {
    total: items.length,
    terminados: terminados.length,
    avance: porcentaje(terminados.length, items.length),
    entregaATiempo: conFechas.length ? porcentaje(aTiempo, conFechas.length) : null,
    atrasados: atrasados.length,
    promedioAtraso: atrasados.length ? atrasados.reduce((suma, item) => suma + item.atraso_dias, 0) / atrasados.length : 0,
    reprogramaciones: notas.filter((nota) => ids.has(nota.item_id) && nota.tipo === 'Reprogramación').length,
    horasResolucion: horasResolucion.length ? horasResolucion.reduce((a, b) => a + b, 0) / horasResolucion.length : null,
  }
}

export function conteoPorEstado(items, campo, sinValor) {
  const grupos = agrupar(items, (item) => item[campo] || sinValor)
  return Object.entries(grupos).map(([categoria, lista]) => ({
    categoria,
    ...Object.fromEntries(ORDEN_ESTADOS.map((estado) => [estado, lista.filter((i) => i.estado === estado).length])),
  }))
}

export function abiertosYAtrasadosPorResponsable(items) {
  const grupos = agrupar(items.filter(estaAbierto), (item) => item.responsable ?? 'Sin asignar')
  return Object.entries(grupos)
    .map(([responsable, lista]) => ({
      responsable,
      abiertos: lista.length,
      atrasados: lista.filter((item) => item.atrasado).length,
    }))
    .sort((a, b) => b.abiertos - a.abiertos)
}

export function modulosConMasAtrasos(items, limite = 10) {
  const grupos = agrupar(items, (item) => item.modulo ?? '-')
  return Object.entries(grupos)
    .map(([modulo, lista]) => ({ modulo, atrasados: lista.filter((item) => item.atrasado).length }))
    .filter((fila) => fila.atrasados > 0)
    .sort((a, b) => b.atrasados - a.atrasados)
    .slice(0, limite)
}

export function alertasPorRegla(registros) {
  const grupos = agrupar(registros, (registro) => registro.regla_codigo)
  return Object.entries(grupos).map(([regla, lista]) => ({
    regla,
    Enviadas: lista.filter((r) => r.estado === 'Enviada').length,
    Fallidas: lista.filter((r) => r.estado === 'Fallida').length,
  }))
}

export function resumenClienteActividad(items) {
  const grupos = agrupar(items, (item) => `${item.cliente ?? 'Sin cliente'}\u0000${item.actividad ?? 'Sin actividad'}`)
  return Object.entries(grupos).map(([clave, lista]) => {
    const [cliente, actividad] = clave.split('\u0000')
    const porEstado = Object.fromEntries(ESTADOS.map((estado) => [estado, lista.filter((i) => i.estado === estado).length]))
    return {
      clave,
      cliente,
      actividad,
      ...porEstado,
      Atrasados: lista.filter((item) => !CERRADOS.includes(item.estado) && item.atrasado).length,
    }
  })
}
