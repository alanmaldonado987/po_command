import { destinoDeItem, itemsSinDestino } from './clickupDestinos.js'
import { encolarAlerta, ErrorApi, registrarLog } from './almacen.js'
import { ahoraIso } from './tiempo.js'
import { vistaBloqueanteAbierto, vistaItem } from './vistas.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const correoValido = (correo) => EMAIL.test((correo ?? '').trim())

const ROLES = {
  responsable: 'Responsable', po: 'Product Owner', equipo: 'Equipo', stakeholders: 'Stakeholder', lider_tecnico: 'Líder técnico / DevOps',
}

export function resolverDestinatarios(estado, { roles, categoria, regla_codigo: reglaCodigo, item_id: itemId, cliente_id: clienteId, audiencia }) {
  const regla = reglaCodigo ? estado.regla_alerta.find((r) => r.codigo === reglaCodigo) : null
  const listaRoles = roles ?? regla?.destinatarios ?? []
  const categoriaFinal = categoria ?? regla?.categoria
  const item = itemId ? estado.item.find((i) => i.id === itemId) : null
  const cliente = clienteId ?? item?.cliente_id
  const po = { nombre: estado.config.po_nombre, correo: estado.config.po_correo }
  const salida = []

  const acepta = (persona) => !persona.recibe.length || persona.recibe.includes(categoriaFinal)
  const agregar = (persona, rol, forzar = false) => {
    if (!persona || !persona.activo || (!forzar && !acepta(persona))) return
    if (correoValido(persona.correo)) salida.push({ nombre: persona.nombre, correo: persona.correo.trim(), rol })
    else if (correoValido(po.correo)) salida.push({ nombre: `${po.nombre} (en lugar de ${persona.nombre}, sin correo)`, correo: po.correo, rol })
  }

  listaRoles.forEach((rol) => {
    if (rol === 'po' && correoValido(po.correo)) salida.push({ nombre: po.nombre, correo: po.correo, rol: ROLES.po })
    if (rol === 'responsable' && item?.responsable_id) agregar(estado.persona.find((p) => p.id === item.responsable_id), ROLES.responsable, true)
    if (rol === 'equipo' || (rol === 'audiencia' && ['equipo', 'todos'].includes(audiencia))) {
      estado.persona.filter((p) => p.tipo === 'equipo').forEach((p) => agregar(p, ROLES.equipo))
    }
    if (rol === 'stakeholders' || (rol === 'audiencia' && ['stakeholders', 'todos'].includes(audiencia))) {
      estado.persona
        .filter((p) => p.tipo === 'stakeholder')
        .filter((p) => !(cliente && rol === 'stakeholders') || estado.persona_cliente.some((pc) => pc.persona_id === p.id && pc.cliente_id === cliente))
        .forEach((p) => agregar(p, ROLES.stakeholders))
    }
    if (rol === 'lider_tecnico') {
      estado.persona.filter((p) => /l[ií]der t[eé]cnico/i.test(p.rol)).forEach((p) => agregar(p, ROLES.lider_tecnico))
    }
  })
  const vistos = new Set()
  return salida.filter((d) => !vistos.has(d.correo.toLowerCase()) && vistos.add(d.correo.toLowerCase()))
}

function despachar(estado) {
  const vencidas = estado.alerta_programada.filter((a) => a.estado === 'Pendiente' && Date.parse(a.enviar_en) <= Date.now())
  vencidas.forEach((alerta) => {
    alerta.estado = 'Enviada'
    alerta.intentos += 1
    alerta.enviado_en = ahoraIso()
    registrarLog(estado, { alerta, regla: alerta.regla_codigo, asunto: alerta.asunto, destinatarios: alerta.destinatarios.join(', '), estadoEnvio: 'Enviada', detalle: 'Simulado' })
  })
  return { enviadas: vencidas.length, fallidas: 0 }
}

function itemGuardado(estado, { resultado }) {
  const item = vistaItem(estado).find((i) => i.id === resultado.id)
  const mensajes = []
  const estabaBloqueado = Boolean(resultado.antes?.bloqueado)
  if (item?.bloqueado && !estabaBloqueado) {
    const destinatarios = resolverDestinatarios(estado, { regla_codigo: 'BLOQUEO_NUEVO', item_id: item.id })
    encolarAlerta(estado, { regla: 'BLOQUEO_NUEVO', entidad: 'item', entidadId: item.id, asunto: `[Bloqueante] ${item.codigo} ${item.cliente ?? ''} · ${item.titulo}`, destinatarios: destinatarios.map((d) => d.correo) })
    mensajes.push(`Alerta de bloqueante para ${destinatarios.length} destinatario(s).`)
  } else if (estabaBloqueado && item && !item.bloqueado) {
    mensajes.push('Bloqueo resuelto: se avisa al equipo y se cancelan los escalamientos.')
  }
  if (resultado.cambios.length && item) {
    const destinatarios = resolverDestinatarios(estado, { regla_codigo: 'REPROGRAMACION', item_id: item.id })
    encolarAlerta(estado, { regla: 'REPROGRAMACION', entidad: 'item', entidadId: item.id, asunto: `[Reprogramación] ${item.codigo} ${item.titulo}`, destinatarios: destinatarios.map((d) => d.correo) })
    mensajes.push(`Reprogramación avisada a ${destinatarios.length} destinatario(s).`)
  }
  despachar(estado)
  return { mensaje: mensajes.join(' ') }
}

function escalar(estado, { bloqueante_id: id }) {
  const bloqueante = vistaBloqueanteAbierto(estado).find((b) => b.id === id)
  if (!bloqueante) throw new ErrorApi('Ese bloqueo ya no está abierto.')
  const destinatarios = resolverDestinatarios(estado, { regla_codigo: 'BLOQUEO_ESCALAR', item_id: bloqueante.item_id })
  estado.bloqueante.find((b) => b.id === id).escalado_en = ahoraIso()
  if (!destinatarios.length) return { ok: false, mensaje: 'No hay destinatarios con correo válido.' }
  encolarAlerta(estado, { regla: 'BLOQUEO_ESCALAR', entidad: 'item', entidadId: bloqueante.item_id, asunto: `[Escalamiento] ${bloqueante.codigo} ${bloqueante.cliente ?? ''} bloqueado`, destinatarios: destinatarios.map((d) => d.correo) })
  despachar(estado)
  return { ok: true, mensaje: 'Escalamiento enviado.' }
}

function recordar(estado, { item_ids: ids }) {
  const responsables = new Set(vistaItem(estado).filter((i) => ids.includes(i.id)).map((i) => i.responsable_id ?? 0))
  responsables.forEach((responsable) => {
    encolarAlerta(estado, { regla: 'VENCIMIENTO', entidad: 'persona', entidadId: responsable || null, asunto: '[Vencimientos] Recordatorio', destinatarios: ['dairo.perez@ises.com.co'] })
  })
  despachar(estado)
  return { correos: responsables.size, mensaje: `${responsables.size} correo(s) de recordatorio enviados (uno por responsable).` }
}

function resumen(estado) {
  const destinatarios = resolverDestinatarios(estado, { regla_codigo: 'RESUMEN_SEMANAL' })
  encolarAlerta(estado, { regla: 'RESUMEN_SEMANAL', entidad: 'portafolio', asunto: '[Resumen semanal] Plan de trabajo', destinatarios: destinatarios.map((d) => d.correo) })
  despachar(estado)
  return { destinatarios: destinatarios.length, mensaje: `Resumen enviado a ${destinatarios.length} destinatario(s).` }
}

function invitarCeremonia(estado, { ceremonia_id: id }) {
  const ceremonia = estado.ceremonia.find((c) => c.id === id)
  if (!ceremonia) throw new ErrorApi('La ceremonia no existe.')
  const destinatarios = resolverDestinatarios(estado, { roles: ['audiencia', 'po'], categoria: 'Ceremonias', audiencia: ceremonia.audiencia })
  encolarAlerta(estado, { regla: 'CEREMONIA', entidad: 'ceremonia', entidadId: id, asunto: `[Invitación] ${ceremonia.titulo}`, destinatarios: destinatarios.map((d) => d.correo) })
  ceremonia.invitacion_enviada = true
  despachar(estado)
  return { destinatarios: destinatarios.length }
}

function tick(estado) {
  encolarAlerta(estado, { regla: 'VENCIMIENTO', entidad: 'persona', asunto: '[Vencimientos] Revisión automática', destinatarios: ['dairo.perez@ises.com.co'] })
  const { enviadas, fallidas } = despachar(estado)
  return { creadas: 1, enviadas, fallidas }
}

export const ALERTAS = {
  tick,
  despachar: (estado) => despachar(estado),
  item_guardado: itemGuardado,
  escalar,
  recordar,
  resumen,
  invitar_ceremonia: invitarCeremonia,
  destinatarios: (estado, cuerpo) => resolverDestinatarios(estado, cuerpo),
}

const estadoSmtp = (smtp) => ({
  host: smtp.host, puerto: smtp.puerto, seguridad: smtp.seguridad, usuario: smtp.usuario, remitente: smtp.remitente,
  nombre_remitente: smtp.nombre_remitente, dry_run: smtp.dry_run, password_guardada: Boolean(smtp.password),
  configurado: Boolean(smtp.host && smtp.usuario && smtp.password && smtp.remitente),
})

export const CORREO = {
  estado: (estado) => estadoSmtp(estado.smtp),
  guardar: (estado, { valores }) => {
    const { password, ...resto } = valores
    Object.assign(estado.smtp, resto, password ? { password } : {})
    return estadoSmtp(estado.smtp)
  },
  probar: (estado) => {
    if (estado.fallas.smtp) return { ok: false, ...estado.fallas.smtp }
    return { ok: true, detalle: `Conexión correcta con ${estado.smtp.host} como ${estado.smtp.usuario}.` }
  },
  prueba: (estado, { destino }) => {
    if (!correoValido(destino)) throw new ErrorApi('Correo de destino inválido.')
    if (estado.fallas.pruebaCorreo) return { ok: false, ...estado.fallas.pruebaCorreo }
    estado.correosDePrueba.push(destino)
    return { ok: true, detalle: `Enviado a ${destino}` }
  },
  modo: (estado, { dry_run: dryRun }) => {
    estado.smtp.dry_run = dryRun
    estado.auditoria.push({ id: Math.max(0, ...estado.auditoria.map((a) => a.id)) + 1, entidad: 'correo', entidad_id: null, accion: dryRun ? 'desactivar' : 'activar', detalle: 'cambio de modo', fecha: ahoraIso() })
    return estadoSmtp(estado.smtp)
  },
}

export const IA = {
  estado: () => ({ disponible: false, modelo: '' }),
  redactar: (_estado, { borrador }) => ({ texto: borrador }),
}

const EQUIPO_CLICKUP = { id: 't1', nombre: 'Ises' }
const ESTADOS_LISTA_CLICKUP = ['PENDIENTE', 'EN DESARROLLO', 'VALIDACIÓN', 'ENTREGADO', 'CERRADO']
const JERARQUIA_CLICKUP = {
  espacios: [
    {
      id: 'sp1',
      nombre: 'Innovación y Desarrollo OTC',
      carpetas: [
        {
          id: 'f1',
          nombre: 'Plan de Trabajo',
          listas: [
            { id: 'l1', nombre: 'AIR-E', estados: ESTADOS_LISTA_CLICKUP },
            { id: 'l2', nombre: 'ELECTROHUILA', estados: ESTADOS_LISTA_CLICKUP },
          ],
        },
      ],
      listas: [{ id: 'l9', nombre: 'Backlog Dev', estados: ESTADOS_LISTA_CLICKUP }],
    },
  ],
}

const estadoClickUp = (estado) => {
  const { clickup, clickup_cola: cola } = estado
  return {
    habilitado: clickup.habilitado,
    token_configurado: Boolean(clickup.token),
    conectado: Boolean(clickup.token),
    equipo: clickup.equipo,
    webhook_registrado: clickup.webhook_registrado,
    pendientes: cola.filter((fila) => fila.estado === 'Pendiente').length,
    con_error: cola.filter((fila) => fila.estado === 'Fallida').length,
    ultimo_sync: clickup.ultimo_sync,
    mapeo_estados: clickup.mapeo_estados,
    tableros: estado.clickup_tablero.map((tablero) => ({
      ...tablero,
      destinos: estado.clickup_destino.filter((destino) => destino.tablero_id === tablero.id).length,
    })),
    sin_destino: itemsSinDestino(estado).length,
  }
}

function sincronizarCola(estado) {
  let errores = 0
  const pendientes = estado.clickup_cola.filter((fila) => fila.estado === 'Pendiente')
  pendientes.forEach((fila) => {
    const item = estado.item.find((candidato) => candidato.id === fila.item_id)
    fila.intentos += 1
    fila.procesado_en = ahoraIso()
    if (item && fila.accion !== 'archive' && !destinoDeItem(estado, item)) {
      fila.estado = 'Fallida'
      fila.error = `Sin destino configurado para el tablero de ${item.codigo}. Configura uno en Configuración & Datos → ClickUp.`
      errores += 1
      return
    }
    if (fila.accion === 'create' && item) {
      item.clickup_task_id = `tarea-${item.id}`
      item.clickup_url = `https://app.clickup.com/t/tarea-${item.id}`
    }
    fila.estado = 'Enviada'
  })
  estado.clickup.ultimo_sync = ahoraIso()
  return { procesadas: pendientes.length - errores, errores }
}

function importarExistentes(estado, { cliente_id: clienteId }) {
  const nuevos = ['Tarea existente A', 'Tarea existente B']
  nuevos.forEach((titulo, indice) => {
    const id = Math.max(0, ...estado.item.map((item) => item.id)) + 1
    estado.item.push({
      id, codigo: `BL-${String(id).padStart(3, '0')}`, producto_id: 1, cliente_id: clienteId ?? null, actividad_id: null, modulo_id: null,
      funcionalidad: titulo, descripcion: '', fase: '', alcance: '', responsable_id: null, estado: 'No iniciado', bloqueado: false,
      motivo_bloqueo: '', terminado_en: null, clave_importacion: null, eliminado_en: null, creado_en: ahoraIso(), actualizado_en: ahoraIso(),
      plan_ini: null, plan_fin: null, plan_pruebas_ini: null, plan_pruebas_fin: null,
      real_ini: null, real_fin: null, real_pruebas_ini: null, real_pruebas_fin: null,
      clickup_task_id: `existente-${indice}`, clickup_url: `https://app.clickup.com/t/existente-${indice}`,
    })
  })
  return { importadas: nuevos.length }
}

function guardarConfigClickUp(estado, valores) {
  const { clickup } = estado
  if ('token' in valores) clickup.token = valores.token
  if ('equipo_id' in valores) clickup.equipo = valores.equipo_id === EQUIPO_CLICKUP.id ? EQUIPO_CLICKUP : null
  if ('mapeo_estados' in valores) clickup.mapeo_estados = valores.mapeo_estados
  if ('habilitado' in valores) {
    if (valores.habilitado && !(clickup.token && clickup.equipo)) throw new ErrorApi('Falta el token o el equipo de ClickUp.')
    clickup.habilitado = valores.habilitado
  }
  return estadoClickUp(estado)
}

const exigirConexion = (estado) => {
  if (!estado.clickup.token) throw new ErrorApi('Falta el token de ClickUp.')
}

export const CLICKUP = {
  estado: estadoClickUp,
  guardar_config: guardarConfigClickUp,
  probar: (estado) => {
    if (estado.fallas.clickup || !estado.clickup.token) return { ok: false }
    return { ok: true, usuario: 'vero@ises.com.co', equipos: [EQUIPO_CLICKUP] }
  },
  jerarquia: (estado) => {
    exigirConexion(estado)
    return JERARQUIA_CLICKUP
  },
  registrar_webhook: (estado) => {
    exigirConexion(estado)
    estado.clickup.webhook_registrado = true
    return { ok: true, webhook_id: 'w1' }
  },
  quitar_webhook: (estado) => {
    estado.clickup.webhook_registrado = false
    return { ok: true }
  },
  sincronizar: sincronizarCola,
  reconciliar: () => ({ creadas: 0, actualizadas: 0, archivadas: 0 }),
  importar_existentes: importarExistentes,
}
