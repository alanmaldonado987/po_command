let secuencia = 0
const siguiente = () => (secuencia += 1)

export function crearItem(sobrescribir = {}) {
  const id = siguiente()
  return {
    id,
    codigo: `BL-${String(id).padStart(3, '0')}`,
    titulo: 'Novedades de flota',
    funcionalidad: 'Novedades de flota',
    descripcion: '',
    producto: 'FieldOps',
    producto_id: 1,
    cliente: 'AIR-E',
    cliente_id: 1,
    actividad: 'SCR',
    actividad_id: 1,
    modulo: 'Torre de Control',
    modulo_id: 1,
    responsable: 'Luis Kendor',
    responsable_id: 1,
    responsable_correo: 'luis@ises.com.co',
    fase: 'Desarrollo',
    alcance: 'Web',
    estado: 'En curso',
    prioridad: null,
    bloqueado: false,
    motivo_bloqueo: '',
    plan_ini: null,
    plan_fin: null,
    plan_pruebas_ini: null,
    plan_pruebas_fin: null,
    real_ini: null,
    real_fin: null,
    real_pruebas_ini: null,
    real_pruebas_fin: null,
    fecha_compromiso: null,
    fecha_entrega: null,
    atraso_dias: 0,
    atrasado: false,
    clave_importacion: null,
    clickup_task_id: null,
    clickup_url: null,
    tablero_id: null,
    tablero: null,
    ...sobrescribir,
  }
}

export function crearPersona(sobrescribir = {}) {
  const id = siguiente()
  return {
    id,
    nombre: `Persona ${id}`,
    correo: `persona${id}@ises.com.co`,
    tipo: 'equipo',
    rol: 'Developer',
    frecuencia_reporte: '',
    recibe: ['Bloqueantes'],
    activo: true,
    cliente_ids: [],
    clientes: '',
    tablero_id: null,
    tablero: null,
    ...sobrescribir,
  }
}

export function crearTablero(sobrescribir = {}) {
  const id = siguiente()
  return { id, nombre: `Tablero ${id}`, mapeo_estados: null, ...sobrescribir }
}

export function crearDestino(sobrescribir = {}) {
  const id = siguiente()
  return { id, tablero_id: null, cliente_id: null, lista_id: 'l9', lista_nombre: 'Backlog Dev', ...sobrescribir }
}

export function crearBloqueante(sobrescribir = {}) {
  const id = siguiente()
  return {
    id,
    item_id: 1,
    motivo: 'Falta acceso a la API',
    severidad: 'Alta',
    abierto_en: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    escalado_en: null,
    codigo: 'BL-001',
    titulo: 'Novedades de flota',
    cliente_id: 1,
    cliente: 'AIR-E',
    actividad: 'SCR',
    modulo: 'Torre de Control',
    responsable: 'Luis Kendor',
    fecha_compromiso: null,
    ...sobrescribir,
  }
}

export function crearCeremonia(sobrescribir = {}) {
  const id = siguiente()
  return {
    id,
    cliente_id: 1,
    cliente: 'AIR-E',
    tipo: 'Demo',
    titulo: 'Demo mensual',
    fecha_hora: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    duracion_min: 60,
    lugar: 'Teams',
    audiencia: 'todos',
    invitacion_enviada: false,
    notas: '',
    ...sobrescribir,
  }
}

export function crearAcuerdo(sobrescribir = {}) {
  const id = siguiente()
  return {
    id,
    ceremonia_id: null,
    origen: 'Demo',
    descripcion: 'Enviar acta',
    responsable_id: 1,
    responsable: 'Luis Kendor',
    fecha_limite: '2026-12-01',
    estado: 'Pendiente',
    ...sobrescribir,
  }
}

export function crearRegla(sobrescribir = {}) {
  const id = siguiente()
  return {
    id,
    codigo: 'VENCIMIENTO',
    nombre: 'Vencimiento de fecha planificada',
    descripcion: 'Un correo diario por responsable',
    categoria: 'Vencimientos',
    destinatarios: ['responsable'],
    parametro: 2,
    hora_envio: '08:00',
    activa: true,
    ...sobrescribir,
  }
}

export function crearNota(sobrescribir = {}) {
  const id = siguiente()
  return { id, item_id: 1, fecha: '2026-11-01', tipo: 'Seguimiento', texto: 'Nota de seguimiento', autor: 'PO', ...sobrescribir }
}

export const consultaOk = (data) => ({ data, isLoading: false, isError: false, error: null })
export const consultaCargando = () => ({ data: undefined, isLoading: true, isError: false, error: null })
export const consultaError = (mensaje = 'fallo') => ({
  data: undefined,
  isLoading: false,
  isError: true,
  error: new Error(mensaje),
})
