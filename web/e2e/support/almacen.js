import { ahoraIso } from './tiempo.js'

export class ErrorApi extends Error {
  constructor(mensaje, { estado = 400, codigo = 'P0001' } = {}) {
    super(mensaje)
    this.estado = estado
    this.codigo = codigo
  }
}

const TABLAS_AUDITADAS = ['item', 'persona', 'ceremonia', 'producto', 'cliente', 'actividad', 'modulo']
const CATALOGOS_UNICOS = ['producto', 'cliente', 'actividad', 'modulo', 'clickup_tablero']

const PREDETERMINADOS = {
  producto: { descripcion: '', estado: 'Activo' },
  cliente: { descripcion: '', estado: 'Activo' },
  actividad: { descripcion: '' },
  modulo: { descripcion: '', producto_id: null },
  persona: { correo: '', rol: '', frecuencia_reporte: '', recibe: [], activo: true },
  ceremonia: { duracion_min: 60, lugar: 'Teams', audiencia: 'equipo', invitacion_enviada: false, notas: '' },
  acuerdo: { ceremonia_id: null, origen: '', responsable_id: null, fecha_limite: null, estado: 'Pendiente' },
  clickup_tablero: { mapeo_estados: null },
  clickup_destino: { tablero_id: null, cliente_id: null },
}

const DEPENDENCIAS_ITEM = { producto: 'producto_id', cliente: 'cliente_id', actividad: 'actividad_id', modulo: 'modulo_id' }

const detalleAuditoria = (fila) =>
  [fila.codigo, fila.nombre, fila.funcionalidad, fila.titulo].filter(Boolean).join(' ')

export function siguienteId(estado, tabla) {
  return Math.max(0, ...estado[tabla].map((fila) => fila.id ?? 0)) + 1
}

export function encolarClickUp(estado, itemId, accion) {
  if (!estado.clickup.habilitado) return
  estado.clickup_cola.push({
    id: siguienteId(estado, 'clickup_cola'), item_id: itemId, accion, estado: 'Pendiente', intentos: 0, error: null,
    creado_en: ahoraIso(), procesado_en: null,
  })
}

export function auditar(estado, entidad, entidadId, accion, detalle) {
  estado.auditoria.push({
    id: siguienteId(estado, 'auditoria'), entidad, entidad_id: entidadId, accion, detalle, fecha: ahoraIso(),
  })
}

function validarNombreUnico(estado, tabla, nombre, idActual = null) {
  if (!CATALOGOS_UNICOS.includes(tabla)) return
  const repetido = estado[tabla].some((fila) => fila.id !== idActual && fila.nombre === nombre)
  if (repetido) {
    throw new ErrorApi(`duplicate key value violates unique constraint "${tabla}_nombre_key"`, { estado: 409, codigo: '23505' })
  }
}

function validarDestinoUnico(estado, tabla, datos, idActual = null) {
  if (tabla !== 'clickup_destino') return
  const repetido = estado.clickup_destino.some(
    (fila) => fila.id !== idActual && (fila.tablero_id ?? null) === (datos.tablero_id ?? null) && (fila.cliente_id ?? null) === (datos.cliente_id ?? null),
  )
  if (repetido) throw new ErrorApi('duplicate key value violates unique constraint "clickup_destino_tablero_cliente_ux"', { estado: 409, codigo: '23505' })
}

export function insertar(estado, tabla, datos) {
  validarNombreUnico(estado, tabla, datos.nombre)
  validarDestinoUnico(estado, tabla, datos)
  const fila = { ...(PREDETERMINADOS[tabla] ?? {}), ...datos, id: datos.id ?? siguienteId(estado, tabla) }
  estado[tabla].push(fila)
  if (TABLAS_AUDITADAS.includes(tabla)) auditar(estado, tabla, fila.id, 'crear', detalleAuditoria(fila))
  return fila
}

export function actualizarFila(estado, tabla, fila, cambios) {
  if ('nombre' in cambios) validarNombreUnico(estado, tabla, cambios.nombre, fila.id)
  validarDestinoUnico(estado, tabla, { ...fila, ...cambios }, fila.id)
  Object.assign(fila, cambios)
  if (TABLAS_AUDITADAS.includes(tabla)) auditar(estado, tabla, fila.id, 'editar', detalleAuditoria(fila))
  return fila
}

export function eliminarFila(estado, tabla, fila) {
  estado[tabla] = estado[tabla].filter((actual) => actual !== fila)
  if (DEPENDENCIAS_ITEM[tabla]) estado.item.forEach((item) => { if (item[DEPENDENCIAS_ITEM[tabla]] === fila.id) item[DEPENDENCIAS_ITEM[tabla]] = null })
  if (tabla === 'clickup_tablero') {
    estado.persona.forEach((persona) => { if (persona.tablero_id === fila.id) persona.tablero_id = null })
    estado.clickup_destino = estado.clickup_destino.filter((destino) => destino.tablero_id !== fila.id)
  }
  if (tabla === 'persona') {
    estado.item.forEach((item) => { if (item.responsable_id === fila.id) item.responsable_id = null })
    estado.acuerdo.forEach((acuerdo) => { if (acuerdo.responsable_id === fila.id) acuerdo.responsable_id = null })
    estado.persona_cliente = estado.persona_cliente.filter((pc) => pc.persona_id !== fila.id)
  }
  if (TABLAS_AUDITADAS.includes(tabla)) auditar(estado, tabla, fila.id, 'eliminar', detalleAuditoria(fila))
}

export function cancelarAlertas(estado, entidad, entidadId, reglas = null) {
  const afectadas = estado.alerta_programada.filter(
    (alerta) =>
      alerta.estado === 'Pendiente' && alerta.entidad === entidad && alerta.entidad_id === entidadId &&
      (!reglas || reglas.includes(alerta.regla_codigo)),
  )
  afectadas.forEach((alerta) => { alerta.estado = 'Cancelada' })
  return afectadas.length
}

export function encolarAlerta(estado, { regla, entidad, entidadId = null, asunto, destinatarios, cuerpo }) {
  const alerta = {
    id: siguienteId(estado, 'alerta_programada'), regla_codigo: regla, entidad, entidad_id: entidadId, asunto,
    destinatarios, estado: 'Pendiente', intentos: 0, error: null, enviar_en: ahoraIso(), creado_en: ahoraIso(),
    enviado_en: null, clave_unica: null, cuerpo_html: cuerpo ?? `<div><h2>${asunto}</h2></div>`,
  }
  estado.alerta_programada.push(alerta)
  return alerta
}

export function registrarLog(estado, { alerta = null, regla, asunto, destinatarios, estadoEnvio, detalle }) {
  estado.notificacion_log.push({
    id: siguienteId(estado, 'notificacion_log'), alerta_id: alerta?.id ?? null, regla_codigo: regla, asunto,
    destinatarios, canal: 'Correo', estado: estadoEnvio, detalle, fecha: ahoraIso(),
  })
}
