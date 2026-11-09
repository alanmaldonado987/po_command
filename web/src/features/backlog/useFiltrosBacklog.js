import { useMemo, useState } from 'react'
import { PRIORIDADES, SIN_PRIORIDAD } from '../../lib/constantes'

export const ORDEN_PLAN = 'Plan de trabajo'
export const ORDEN_PRIORIDAD = 'Prioridad'

const FILTROS_VACIOS = {
  texto: '',
  producto: [],
  cliente: [],
  actividad: [],
  estado: [],
  modulo: [],
  responsable: [],
  alcance: [],
  fase: [],
  prioridad: [],
  orden: ORDEN_PLAN,
}

const CAMPOS_LISTA = ['producto', 'cliente', 'actividad', 'modulo', 'responsable', 'alcance', 'fase']

function coincideEstado(item, estados) {
  return (
    estados.includes(item.estado) ||
    (estados.includes('Bloqueado') && item.bloqueado) ||
    (estados.includes('Atrasado') && item.atrasado)
  )
}

const rangoPrioridad = (item) => {
  const rango = PRIORIDADES.indexOf(item.prioridad)
  return rango === -1 ? PRIORIDADES.length : rango
}

export function useFiltrosBacklog(items, notas) {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)

  const cambiar = (campo) => (valor) => setFiltros((actuales) => ({ ...actuales, [campo]: valor }))

  const filtrados = useMemo(() => {
    const texto = filtros.texto.trim().toLowerCase()
    const conNota = texto
      ? new Set(notas.filter((nota) => nota.texto.toLowerCase().includes(texto)).map((nota) => nota.item_id))
      : null
    const coincidentes = items.filter((item) => {
      if (conNota && !`${item.codigo} ${item.titulo} ${item.descripcion}`.toLowerCase().includes(texto) && !conNota.has(item.id)) {
        return false
      }
      if (CAMPOS_LISTA.some((campo) => filtros[campo].length && !filtros[campo].includes(item[campo]))) return false
      if (filtros.prioridad.length && !filtros.prioridad.includes(item.prioridad ?? SIN_PRIORIDAD)) return false
      return !filtros.estado.length || coincideEstado(item, filtros.estado)
    })
    return filtros.orden === ORDEN_PRIORIDAD ? [...coincidentes].sort((a, b) => rangoPrioridad(a) - rangoPrioridad(b)) : coincidentes
  }, [items, notas, filtros])

  return { filtros, cambiar, filtrados }
}
