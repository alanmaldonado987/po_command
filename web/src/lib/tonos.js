export const CLASES_TONO = {
  rojo: 'bg-danger-soft text-danger-ink',
  ambar: 'bg-warning-soft text-warning-ink',
  azul: 'bg-brand-soft text-brand-dark',
  verde: 'bg-[#DCFCE7] text-[#166534]',
  gris: 'bg-line-soft text-ink-soft',
  violeta: 'bg-violet-soft text-violet-ink',
  oscuro: 'bg-white/10 text-slate-200',
}

export const TONO_ESTADO = {
  'En curso': 'azul',
  'Terminado, en etapa de pruebas': 'ambar',
  Terminado: 'verde',
  Bloqueado: 'rojo',
  'No iniciado': 'gris',
  Suspendido: 'violeta',
  Reprogramación: 'ambar',
  Bloqueo: 'rojo',
  Planificación: 'azul',
  Ejecución: 'verde',
  Seguimiento: 'gris',
  Enviada: 'verde',
  Fallida: 'rojo',
  Pendiente: 'azul',
  Cancelada: 'gris',
  Omitida: 'gris',
  Cumplido: 'verde',
  Vencido: 'rojo',
}

export const TONO_PRIORIDAD = { Urgente: 'rojo', Alta: 'ambar', Normal: 'azul', Baja: 'gris' }

export const tonoEstado = (estado) => TONO_ESTADO[estado] ?? 'gris'
export const tonoPrioridad = (prioridad) => TONO_PRIORIDAD[prioridad] ?? 'gris'
export const tonoSeveridad = (severidad) => (severidad === 'Alta' ? 'rojo' : 'ambar')
export const tonoPersona = (tipo) => (tipo === 'equipo' ? 'azul' : 'ambar')
