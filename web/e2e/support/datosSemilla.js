import { ahoraIso, enDias, haceDias } from './tiempo.js'

const CLIENTES = ['AIR-E', 'ELECTROHUILA', 'ACUACAR']
const ACTIVIDADES = ['SCR', 'Cobro', 'Multifamiliares SCR']
const MODULOS = ['Torre de Control', 'Órdenes', 'Planeación Operativa', 'Maestro BD']

const CATEGORIAS_EQUIPO = ['Bloqueantes', 'Vencimientos', 'Reprogramaciones', 'Ceremonias']
const CATEGORIAS_STAKEHOLDER = ['Bloqueantes', 'Escalamientos', 'Ceremonias', 'Resumen semanal']

const PERSONAS = [
  ['Luis Kendor Narváez', 'luis.kendor@ises.com.co', 'equipo', 'Líder técnico', CATEGORIAS_EQUIPO, []],
  ['Dairo Pérez', 'dairo.perez@ises.com.co', 'equipo', 'Developer', CATEGORIAS_EQUIPO, []],
  ['Marcela Ríos', '', 'equipo', 'QA', CATEGORIAS_EQUIPO, []],
  ['Carlos Gómez', 'carlos.gomez@air-e.com', 'stakeholder', 'Gerente', CATEGORIAS_STAKEHOLDER, [1]],
  ['Julio Mora', 'julio.mora@electrohuila.co', 'stakeholder', 'Director', CATEGORIAS_STAKEHOLDER, [2]],
  ['Ana Torres', 'ana.torres@empresa.co', 'stakeholder', 'Coordinadora', CATEGORIAS_STAKEHOLDER, [3]],
]

const ITEM_BASE = {
  descripcion: '',
  fase: 'Desarrollo',
  alcance: 'Web',
  plan_ini: null,
  plan_fin: null,
  plan_pruebas_ini: null,
  plan_pruebas_fin: null,
  real_ini: null,
  real_fin: null,
  real_pruebas_ini: null,
  real_pruebas_fin: null,
  estado: 'No iniciado',
  prioridad: null,
  bloqueado: false,
  motivo_bloqueo: '',
  terminado_en: null,
  clave_importacion: null,
  eliminado_en: null,
  clickup_task_id: null,
  clickup_url: null,
}

const ITEMS = [
  { cliente: 1, actividad: 1, modulo: 1, funcionalidad: 'Mapa de flota', responsable: 2, alcance: 'Web', estado: 'Terminado', plan_fin: haceDias(40), real_fin: haceDias(42) },
  { cliente: 1, actividad: 1, modulo: 1, funcionalidad: 'Novedades de personal', responsable: 2, alcance: 'Mobile', estado: 'Terminado', plan_fin: haceDias(30), real_fin: haceDias(30) },
  { cliente: 2, actividad: 2, modulo: 2, funcionalidad: 'Completo', responsable: 1, alcance: 'Web', estado: 'Terminado', plan_pruebas_fin: haceDias(25), real_pruebas_fin: haceDias(26) },
  { cliente: 1, actividad: 2, modulo: 2, funcionalidad: 'Órdenes de cobro', responsable: 2, alcance: 'Web', estado: 'Terminado', plan_fin: haceDias(20), real_fin: haceDias(15) },
  { cliente: 3, actividad: 3, modulo: 3, funcionalidad: 'Matriz de recomendación', responsable: 1, alcance: 'Data', estado: 'Terminado', plan_fin: haceDias(18), real_fin: haceDias(10) },
  { cliente: 1, actividad: 1, modulo: 1, funcionalidad: 'Tablero de supervisión', responsable: 2, alcance: 'Web', estado: 'Terminado, en etapa de pruebas', plan_pruebas_fin: enDias(4), real_fin: haceDias(3) },
  { cliente: 1, actividad: 1, modulo: 2, funcionalidad: 'Asignación masiva', responsable: 2, alcance: 'Mobile', estado: 'Terminado, en etapa de pruebas', plan_pruebas_fin: enDias(9), real_fin: haceDias(1) },
  { cliente: 2, actividad: 2, modulo: 3, funcionalidad: 'Históricos mano de obra', responsable: 1, alcance: 'Web', estado: 'Terminado, en etapa de pruebas', plan_pruebas_fin: enDias(12), real_fin: haceDias(2) },
  { cliente: 1, actividad: 1, modulo: 1, funcionalidad: 'Rutas de supervisión', responsable: 2, alcance: 'Mobile', estado: 'En curso', plan_ini: haceDias(40), plan_fin: haceDias(12), real_ini: haceDias(38) },
  { cliente: 1, actividad: 2, modulo: 2, funcionalidad: 'Cierre de órdenes', responsable: 1, alcance: 'Web', estado: 'En curso', plan_ini: haceDias(30), plan_fin: haceDias(5), real_ini: haceDias(29) },
  { cliente: 2, actividad: 1, modulo: 1, funcionalidad: 'Alertas de presencia', responsable: 2, alcance: 'Mobile', estado: 'En curso', plan_ini: haceDias(20), plan_fin: haceDias(3), real_ini: haceDias(19) },
  { cliente: 2, actividad: 2, modulo: 4, funcionalidad: 'Carga de balanza', responsable: 1, alcance: 'Automatización', estado: 'En curso', plan_ini: haceDias(50), plan_fin: haceDias(25), real_ini: haceDias(48) },
  { cliente: 3, actividad: 3, modulo: 3, funcionalidad: 'Priorización de brigadas', responsable: 2, alcance: 'Data', estado: 'En curso', plan_ini: haceDias(35), plan_fin: haceDias(1), real_ini: haceDias(34) },
  { cliente: 1, actividad: 1, modulo: 1, funcionalidad: 'Reporte de conformidad', responsable: 2, alcance: 'Web', estado: 'En curso', plan_ini: haceDias(10), plan_fin: enDias(3), real_ini: haceDias(9) },
  { cliente: 2, actividad: 1, modulo: 2, funcionalidad: 'Bandeja de órdenes', responsable: 1, alcance: 'Web', estado: 'En curso', plan_ini: haceDias(8), plan_fin: enDias(2), real_ini: haceDias(7) },
  { cliente: 3, actividad: 2, modulo: 1, funcionalidad: 'Mapa de brigadas', responsable: 2, alcance: 'Mobile', estado: 'En curso', plan_ini: haceDias(5), plan_fin: enDias(6), real_ini: haceDias(4) },
  { cliente: 1, actividad: 3, modulo: 3, funcionalidad: 'Planeación semanal', responsable: 1, alcance: 'Web', estado: 'En curso', plan_ini: haceDias(2), plan_fin: enDias(30), real_ini: haceDias(1) },
  { cliente: 3, actividad: 3, modulo: 4, funcionalidad: 'Maestro de tarifas', responsable: 2, alcance: 'Data', estado: 'En curso', plan_ini: haceDias(1), plan_fin: enDias(45), real_ini: haceDias(1) },
  { cliente: 1, actividad: 1, modulo: 1, funcionalidad: 'Notificaciones push', responsable: 2, alcance: 'APK', estado: 'No iniciado', plan_ini: enDias(10), plan_fin: enDias(40) },
  { cliente: 2, actividad: 3, modulo: 2, funcionalidad: 'Exportación a Excel', responsable: 1, alcance: 'Web', estado: 'No iniciado', plan_ini: enDias(15), plan_fin: enDias(50) },
  { cliente: 3, actividad: 1, modulo: 3, funcionalidad: 'Tablero de metas', responsable: null, alcance: 'Web', estado: 'No iniciado' },
  { cliente: 2, actividad: 2, modulo: 1, funcionalidad: 'Mapa de calor', responsable: 2, alcance: 'Web', estado: 'No iniciado' },
  { cliente: 3, actividad: 3, modulo: 2, funcionalidad: 'Integración con SAP', responsable: 1, alcance: 'Automatización', estado: 'Suspendido', plan_fin: haceDias(8) },
  { cliente: 1, actividad: 1, modulo: 1, funcionalidad: 'Control de acceso', responsable: 2, alcance: 'Web', estado: 'En curso', plan_ini: haceDias(30), plan_fin: haceDias(6), real_ini: haceDias(29), bloqueado: true, motivo_bloqueo: 'Falta acceso al servidor del cliente' },
  { cliente: 2, actividad: 1, modulo: 2, funcionalidad: 'Sincronización offline', responsable: 1, alcance: 'Mobile', estado: 'En curso', plan_ini: haceDias(6), plan_fin: enDias(20), real_ini: haceDias(5), bloqueado: true, motivo_bloqueo: 'Pendiente definición de API del proveedor' },
]

const NOTAS = [
  [4, 'Seguimiento', 'Se entrega con ajustes menores', haceDias(14)],
  [9, 'Reprogramación', 'Cambio de fechas · fin planificado: 01/10/2026 → 25/10/2026', haceDias(20)],
  [10, 'Planificación', 'Pendiente de certificado SSL del cliente', haceDias(9)],
  [11, 'Reprogramación', 'Cambio de fechas · fin planificado: 15/10/2026 → 03/11/2026', haceDias(7)],
  [24, 'Bloqueo', 'Bloqueado: Falta acceso al servidor del cliente', haceDias(4)],
  [25, 'Bloqueo', 'Bloqueado: Pendiente definición de API del proveedor', haceDias(1)],
]

const REGLAS = [
  ['BLOQUEO_NUEVO', 'Nuevo bloqueante', 'Un ítem del backlog pasa a bloqueado (envío inmediato)', 'Bloqueantes', ['responsable', 'po', 'stakeholders'], 0, '00:00'],
  ['BLOQUEO_RESUELTO', 'Bloqueo resuelto', 'Un ítem deja de estar bloqueado (envío inmediato)', 'Bloqueantes', ['responsable', 'po', 'stakeholders'], 0, '00:00'],
  ['BLOQUEO_ESCALAR', 'Escalamiento de bloqueante', 'Sigue bloqueado más de N horas; se repite cada 24 h', 'Escalamientos', ['stakeholders', 'lider_tecnico', 'po'], 48, '00:00'],
  ['VENCIMIENTO', 'Vencimiento de fecha planificada', 'Un correo diario por responsable con sus ítems vencidos o a N días de su fecha fin planificada', 'Vencimientos', ['responsable'], 2, '08:00'],
  ['REPROGRAMACION', 'Reprogramación', 'Cambia una fecha planificada de un ítem (envío inmediato)', 'Reprogramaciones', ['responsable', 'po'], 0, '00:00'],
  ['CEREMONIA', 'Recordatorio de ceremonia', 'N horas antes y 1 hora antes de cada ceremonia', 'Ceremonias', ['audiencia'], 24, '00:00'],
  ['ACUERDO_VENCIDO', 'Acuerdo vencido', 'Un acuerdo de ceremonia pasó su fecha límite sin cumplirse', 'Vencimientos', ['responsable', 'po'], 0, '08:00'],
  ['RESUMEN_SEMANAL', 'Resumen semanal', 'Avance por cliente, bloqueos, atrasos y próximos hitos cada lunes', 'Resumen semanal', ['po', 'stakeholders'], 0, '07:30'],
]

const fechaHora = (dias, hora) => new Date(`${enDias(dias)}T${hora}:00-05:00`).toISOString()

const CEREMONIAS = [
  [1, 'Demo', 'Demo AIR-E octubre', fechaHora(2, '10:00'), 60, 'Teams', 'todos', true],
  [2, 'Seguimiento', 'Seguimiento ELECTROHUILA', fechaHora(1, '09:00'), 45, 'Teams', 'equipo', false],
  [null, 'Retro', 'Retro del sprint', fechaHora(5, '15:00'), 60, 'Sala 3', 'equipo', false],
  [3, 'Planning', 'Planning ACUACAR pasado', fechaHora(-3, '08:00'), 90, 'Teams', 'equipo', true],
]

const ACUERDOS = [
  ['Enviar certificado SSL', 'Seguimiento ELECTROHUILA', 2, haceDias(2), 'Pendiente'],
  ['Definir API con el proveedor', 'Demo AIR-E', 1, enDias(7), 'En curso'],
  ['Actualizar manual de usuario', 'Retro', 3, haceDias(10), 'Cumplido'],
]

const HTML_CORREO = (titulo) => `<div><h2>${titulo}</h2><p>Contenido de la alerta de prueba.</p></div>`

const ALERTAS = [
  ['BLOQUEO_ESCALAR', 'item', 24, '[Escalamiento] BL-024 AIR-E bloqueado 96 h', ['carlos.gomez@air-e.com', 'vrodriguez@ises.com.co'], 2, 'Pendiente', 0, null],
  ['VENCIMIENTO', 'persona', 2, '[Vencimientos] Dairo Pérez: 4 vencido(s), 2 por vencer', ['dairo.perez@ises.com.co'], 3, 'Pendiente', 0, null],
  ['CEREMONIA', 'ceremonia', 1, '[Recordatorio] Demo AIR-E octubre', ['dairo.perez@ises.com.co'], 20, 'Pendiente', 0, null],
  ['REPROGRAMACION', 'item', 9, '[Reprogramación] BL-009 Rutas de supervisión', ['dairo.perez@ises.com.co'], -30, 'Fallida', 3, 'SMTPAuthError: 535 credenciales'],
  ['RESUMEN_SEMANAL', 'portafolio', null, '[Resumen semanal] Plan de trabajo semana 45', ['vrodriguez@ises.com.co'], -50, 'Fallida', 3, 'Timeout de conexión'],
  ['BLOQUEO_NUEVO', 'item', 24, '[Bloqueante] BL-024 AIR-E · Control de acceso', ['dairo.perez@ises.com.co'], -90, 'Enviada', 1, null],
  ['BLOQUEO_NUEVO', 'item', 25, '[Bloqueante] BL-025 ELECTROHUILA · Sincronización offline', ['luis.kendor@ises.com.co'], -2, 'Enviada', 1, null],
  ['ACUERDO_VENCIDO', 'acuerdo', 1, '[Acuerdo vencido] Enviar certificado SSL', ['luis.kendor@ises.com.co'], -40, 'Cancelada', 0, null],
]

const AUDITORIA = [
  ['item', 25, 'crear', 'BL-025 Sincronización offline', -26],
  ['persona', 3, 'editar', 'Marcela Ríos', -48],
  ['cliente', 3, 'crear', 'ACUACAR', -120],
]

const idDe = (indice) => indice + 1

function construirItems() {
  return ITEMS.map((datos, indice) => {
    const { cliente, actividad, modulo, responsable, ...resto } = datos
    const codigo = `BL-${String(idDe(indice)).padStart(3, '0')}`
    return {
      ...ITEM_BASE,
      ...resto,
      id: idDe(indice),
      codigo,
      producto_id: 1,
      cliente_id: cliente,
      actividad_id: actividad,
      modulo_id: modulo,
      responsable_id: responsable,
      terminado_en: resto.estado === 'Terminado' ? (resto.real_pruebas_fin ?? resto.real_fin) : null,
      creado_en: ahoraIso(-24 * 60),
      actualizado_en: ahoraIso(-24 * 5),
    }
  })
}

export function crearSemilla() {
  const items = construirItems()
  const bloqueados = items.filter((item) => item.bloqueado)
  return {
    config: {
      po_nombre: 'Verónica Rodríguez',
      po_correo: 'vrodriguez@ises.com.co',
      aviso_inicio: 'Se cargaron 25 ítems de tu Plan de Trabajo. Revisa los correos del equipo en Equipo & Stakeholders.',
    },
    producto: [{ id: 1, nombre: 'FieldOps', descripcion: '', estado: 'Activo' }],
    cliente: CLIENTES.map((nombre, i) => ({ id: idDe(i), nombre, descripcion: '', estado: 'Activo' })),
    actividad: ACTIVIDADES.map((nombre, i) => ({ id: idDe(i), nombre, descripcion: '' })),
    modulo: MODULOS.map((nombre, i) => ({ id: idDe(i), nombre, descripcion: '', producto_id: 1 })),
    persona: PERSONAS.map(([nombre, correo, tipo, rol, recibe], i) => ({
      id: idDe(i), nombre, correo, tipo, rol, recibe, activo: true, frecuencia_reporte: tipo === 'stakeholder' ? 'Resumen semanal' : '',
      tablero_id: null,
    })),
    persona_cliente: PERSONAS.flatMap(([, , , , , clientes], i) => clientes.map((cliente_id) => ({ persona_id: idDe(i), cliente_id }))),
    item: items,
    nota: NOTAS.map(([item_id, tipo, texto, fecha], i) => ({ id: idDe(i), item_id, tipo, texto, fecha, autor: 'Automática', creado_en: ahoraIso(-48) })),
    bloqueante: [
      ...bloqueados.map((item, i) => ({
        id: idDe(i), item_id: item.id, motivo: item.motivo_bloqueo, severidad: i === 0 ? 'Alta' : 'Media',
        abierto_en: ahoraIso(i === 0 ? -96 : -24), escalado_en: null, resuelto_en: null,
      })),
      { id: 3, item_id: 9, motivo: 'Falta de datos de prueba', severidad: 'Media', abierto_en: ahoraIso(-120), escalado_en: null, resuelto_en: ahoraIso(-72) },
    ],
    ceremonia: CEREMONIAS.map(([cliente_id, tipo, titulo, fecha_hora, duracion_min, lugar, audiencia, invitacion_enviada], i) => ({
      id: idDe(i), cliente_id, tipo, titulo, fecha_hora, duracion_min, lugar, audiencia, invitacion_enviada, notas: '',
    })),
    acuerdo: ACUERDOS.map(([descripcion, origen, responsable_id, fecha_limite, estado], i) => ({
      id: idDe(i), ceremonia_id: null, descripcion, origen, responsable_id, fecha_limite, estado,
    })),
    regla_alerta: REGLAS.map(([codigo, nombre, descripcion, categoria, destinatarios, parametro, hora_envio], i) => ({
      id: idDe(i), codigo, nombre, descripcion, categoria, destinatarios, parametro, hora_envio, activa: true,
    })),
    alerta_programada: ALERTAS.map(([regla_codigo, entidad, entidad_id, asunto, destinatarios, horas, estado, intentos, error], i) => ({
      id: idDe(i), regla_codigo, entidad, entidad_id, asunto, destinatarios, estado, intentos, error,
      enviar_en: ahoraIso(horas), cuerpo_html: HTML_CORREO(asunto), clave_unica: null, creado_en: ahoraIso(-100), enviado_en: estado === 'Enviada' ? ahoraIso(horas) : null,
    })),
    notificacion_log: ALERTAS.filter(([, , , , , , estado]) => estado !== 'Pendiente' && estado !== 'Cancelada').map(
      ([regla_codigo, , , asunto, destinatarios, horas, estado, , error], i) => ({
        id: idDe(i), alerta_id: null, regla_codigo, asunto, destinatarios: destinatarios.join(', '), estado, detalle: error ?? 'Enviado', canal: 'Correo', fecha: ahoraIso(horas),
      }),
    ),
    auditoria: AUDITORIA.map(([entidad, entidad_id, accion, detalle, horas], i) => ({ id: idDe(i), entidad, entidad_id, accion, detalle, fecha: ahoraIso(horas) })),
    clickup_tablero: [],
    clickup_destino: [],
    clickup_cola: [],
    clickup: { token: '', equipo: null, habilitado: false, webhook_registrado: false, mapeo_estados: {}, ultimo_sync: null, estados_remotos: {} },
    smtp: { host: 'smtp.office365.com', puerto: 587, seguridad: 'starttls', usuario: '', password: '', remitente: '', nombre_remitente: 'PO Command Center', dry_run: true },
  }
}

export const ESPERADO = {
  items: ITEMS.length,
  clientes: CLIENTES.length,
  bloqueantes: ITEMS.filter((item) => item.bloqueado).length,
  terminados: ITEMS.filter((item) => item.estado === 'Terminado').length,
  enPruebas: ITEMS.filter((item) => item.estado === 'Terminado, en etapa de pruebas').length,
  abiertos: ITEMS.filter((item) => !['Terminado', 'Suspendido'].includes(item.estado)).length,
  atrasados: ITEMS.filter((item) => {
    if (['Terminado', 'Suspendido'].includes(item.estado)) return false
    const compromiso = item.plan_pruebas_fin ?? item.plan_fin
    return Boolean(compromiso) && compromiso < enDias(0)
  }).length,
  alertasEnCola: ALERTAS.filter((alerta) => alerta[6] === 'Pendiente').length,
  alertasFallidas: ALERTAS.filter((alerta) => alerta[6] === 'Fallida').length,
}
