export const ESTADOS = [
  'No iniciado',
  'En curso',
  'Terminado, en etapa de pruebas',
  'Terminado',
  'Suspendido',
]
export const ESTADO_PRUEBAS = 'Terminado, en etapa de pruebas'
export const CERRADOS = ['Terminado', 'Suspendido']
export const FASES = ['Desarrollo', 'Customización']
export const PRIORIDADES = ['Urgente', 'Alta', 'Normal', 'Baja']
export const SIN_PRIORIDAD = 'Sin prioridad'
export const ALCANCES = ['Web', 'Mobile', 'Data', 'Automatización', 'APK']
export const TIPOS_NOTA = ['Seguimiento', 'Planificación', 'Ejecución']
export const CATEGORIAS = [
  'Bloqueantes',
  'Vencimientos',
  'Reprogramaciones',
  'Ceremonias',
  'Escalamientos',
  'Demos',
  'Resumen semanal',
]

export const CAMPOS_FECHA = {
  plan_ini: 'inicio planificado',
  plan_fin: 'fin planificado',
  plan_pruebas_ini: 'inicio de pruebas planificado',
  plan_pruebas_fin: 'fin de pruebas planificado',
  real_ini: 'inicio ejecutado',
  real_fin: 'fin ejecutado',
  real_pruebas_ini: 'inicio de pruebas ejecutado',
  real_pruebas_fin: 'fin de pruebas ejecutado',
}

export const COLOR_ESTADO = {
  'No iniciado': '#94A3B8',
  'En curso': '#0369A1',
  [ESTADO_PRUEBAS]: '#D97706',
  Terminado: '#059669',
  Suspendido: '#475569',
  Bloqueado: '#DC2626',
}

export const PALETA = {
  azul: '#0369A1',
  verde: '#059669',
  ambar: '#D97706',
  rojo: '#DC2626',
  violeta: '#7C3AED',
  gris: '#64748B',
  tinta: '#0F172A',
}

export const ROLES_DESTINATARIO = {
  responsable: 'Responsable',
  po: 'Product Owner',
  equipo: 'Equipo',
  stakeholders: 'Stakeholders del cliente',
  lider_tecnico: 'Líder técnico / DevOps',
  audiencia: 'Invitados de la ceremonia',
}

export const TIPOS_CEREMONIA = ['Seguimiento', 'Daily', 'Planning', 'Refinamiento', 'Demo', 'Retro']
export const TONO_CEREMONIA = {
  Seguimiento: 'azul',
  Daily: 'gris',
  Planning: 'azul',
  Refinamiento: 'verde',
  Demo: 'ambar',
  Retro: 'violeta',
}
export const AUDIENCIAS = {
  equipo: 'Equipo',
  stakeholders: 'Stakeholders',
  todos: 'Equipo y stakeholders',
}
export const ESTADOS_ACUERDO = ['Pendiente', 'En curso', 'Cumplido']
export const ESTADOS_CATALOGO = ['Activo', 'Pausado', 'Cerrado']
export const FRECUENCIAS_REPORTE = ['', 'Demo', 'Resumen semanal', 'Mensual']
export const TIPOS_PERSONA = { equipo: 'Equipo de desarrollo', stakeholder: 'Stakeholders' }

export const UNIDAD_REGLA = {
  BLOQUEO_ESCALAR: 'horas bloqueada',
  VENCIMIENTO: 'días antes',
  CEREMONIA: 'horas antes',
}
export const ICONO_REGLA = {
  BLOQUEO_NUEVO: 'report',
  BLOQUEO_RESUELTO: 'task_alt',
  BLOQUEO_ESCALAR: 'campaign',
  VENCIMIENTO: 'schedule',
  CEREMONIA: 'event',
  REPROGRAMACION: 'event_repeat',
  ACUERDO_VENCIDO: 'handshake',
  RESUMEN_SEMANAL: 'summarize',
}
export const ESTADOS_COLA = ['Pendiente', 'Fallida', 'Enviada', 'Cancelada']

export const PROVEEDORES_CORREO = {
  'Office 365 / Outlook': { host: 'smtp.office365.com', puerto: 587, seguridad: 'starttls' },
  'Gmail / Google Workspace': { host: 'smtp.gmail.com', puerto: 587, seguridad: 'starttls' },
  'Otro servidor': null,
}

export const CATALOGOS = {
  cliente: 'Clientes',
  actividad: 'Actividades',
  modulo: 'Módulos / componentes',
  producto: 'Productos',
}
