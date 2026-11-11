export const ACCIONES_COLA = { create: 'Crear', update: 'Actualizar', archive: 'Archivar', mover: 'Mover' }

export const FILTROS_COLA = {
  todos: { etiqueta: 'Todos', estados: null },
  pendientes: { etiqueta: 'Pendientes', estados: ['Pendiente'] },
  errores: { etiqueta: 'Con error', estados: ['Fallida'] },
  enviados: { etiqueta: 'Enviados', estados: ['Enviada'] },
}

export const LIMITE_PAGINA_COLA = 20
export const LIMITE_ABIERTOS_COLA = 100

const RANGO_ESTADO = { Fallida: 0, Pendiente: 1 }

export const ordenarAbiertos = (filas) =>
  [...filas].sort((a, b) => (RANGO_ESTADO[a.estado] ?? 2) - (RANGO_ESTADO[b.estado] ?? 2) || b.id - a.id)

const EXPLICACIONES = [
  [
    /sin destino configurado/i,
    'Ese ítem no tiene una lista de destino. Configura el destino de su tablero y cliente (o uno por defecto) en la tarjeta Destinos.',
  ],
  [
    /\b(401|403)\b|unauthorized|forbidden/i,
    'ClickUp rechazó el acceso. Revisa el token personal y sus permisos en la tarjeta Conexión.',
  ],
  [/\b404\b|not found/i, 'ClickUp no encontró la tarea o la lista. Puede haberse eliminado o movido.'],
  [/\b429\b|rate limit|too many/i, 'ClickUp limitó las peticiones. El envío se reintenta solo.'],
  [
    /\b400\b|estado no válido|invalid status/i,
    'ClickUp rechazó un dato del envío, por ejemplo un estado que no existe en la lista. Revisa el mapeo de estados.',
  ],
  [/\b5\d\d\b|timeout|timed out|econn|network/i, 'ClickUp no respondió bien (error de su servidor o de red). Se reintenta.'],
]

export const explicarError = (texto) => EXPLICACIONES.find(([patron]) => patron.test(texto ?? ''))?.[1] ?? null
