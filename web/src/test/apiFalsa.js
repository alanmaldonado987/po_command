import { vi } from 'vitest'

const CONFIG_CORREO = {
  host: 'smtp.office365.com',
  puerto: 587,
  seguridad: 'starttls',
  usuario: '',
  remitente: '',
  nombre_remitente: 'PO Command Center',
  dry_run: true,
  password_guardada: false,
  configurado: false,
}

export const ESTADO_CLICKUP_BASE = {
  habilitado: false,
  token_configurado: false,
  conectado: false,
  equipo: null,
  webhook_registrado: false,
  pendientes: 0,
  con_error: 0,
  ultimo_sync: null,
  mapeo_estados: {},
  sin_destino: 0,
}

const ESTADOS_LISTA = ['PENDIENTE', 'EN DESARROLLO', 'VALIDACIÓN', 'ENTREGADO', 'CERRADO']

export const JERARQUIA_CLICKUP = {
  espacios: [
    {
      id: 'sp1',
      nombre: 'Innovación y Desarrollo OTC',
      carpetas: [
        {
          id: 'f1',
          nombre: 'Plan de Trabajo',
          listas: [
            { id: 'l1', nombre: 'AIR-E', estados: ESTADOS_LISTA },
            { id: 'l2', nombre: 'ELECTROHUILA', estados: ESTADOS_LISTA },
          ],
        },
      ],
      listas: [{ id: 'l9', nombre: 'Backlog Dev', estados: ESTADOS_LISTA }],
    },
  ],
}

const nombres = (...lista) => Object.fromEntries(lista.map((nombre) => [nombre, vi.fn()]))

export const items = nombres(
  'listarItems', 'guardarItem', 'eliminarItem', 'listarNotas', 'listarTodasLasNotas', 'eliminarNota',
  'listarBloqueantesAbiertos', 'listarBloqueantes',
)
export const catalogos = nombres('listarCatalogo', 'crearRegistro', 'actualizarRegistro', 'eliminarRegistro')
export const personas = nombres('listarPersonas', 'guardarPersona', 'eliminarPersona')
export const ceremonias = nombres(
  'listarCeremonias', 'guardarCeremonia', 'eliminarCeremonia', 'listarAcuerdos', 'guardarAcuerdo', 'eliminarAcuerdo',
)
export const alertas = nombres(
  'listarReglas', 'actualizarRegla', 'listarCola', 'listarProximasAlertas', 'obtenerCuerpoAlerta', 'cancelarAlertas',
  'reintentarAlertas', 'contarAlertas', 'listarLog', 'listarAlertasPorRegla', 'revisarReglasAhora', 'despacharCola',
  'notificarItemGuardado', 'escalarBloqueo', 'enviarResumenSemanal', 'recordarVencimientos', 'invitarCeremonia',
  'resolverDestinatarios',
)
export const correo = nombres(
  'obtenerConfigCorreo', 'guardarConfigCorreo', 'probarConexionCorreo', 'enviarCorreoPrueba', 'cambiarModoEnvio',
)
export const ia = nombres('obtenerEstadoIa', 'redactarConModelo')
export const clickup = nombres(
  'obtenerEstadoClickUp', 'guardarConfigClickUp', 'probarClickUp', 'obtenerJerarquiaClickUp', 'registrarWebhookClickUp',
  'quitarWebhookClickUp', 'sincronizarClickUp', 'reconciliarClickUp', 'importarExistentesClickUp', 'listarDestinos',
  'guardarDestino', 'eliminarDestino', 'listarColaClickUp', 'listarPendientesDeItem', 'listarTableros', 'crearTablero',
  'actualizarTablero', 'eliminarTablero',
)
export const configuracion = {
  ...nombres('obtenerConfiguracion', 'guardarConfiguracion', 'listarAuditoria', 'importarPlan', 'leerTabla'),
  TABLAS_EXPORTABLES: ['item'],
}

const todos = [items, catalogos, personas, ceremonias, alertas, correo, ia, configuracion, clickup]

export function reiniciarApiFalsa() {
  todos.forEach((modulo) => Object.values(modulo).forEach((funcion) => funcion.mockReset?.()))
  const resolver = (funcion, valor) => funcion.mockResolvedValue(valor)

  resolver(items.listarItems, [])
  resolver(items.listarTodasLasNotas, [])
  resolver(items.listarNotas, [])
  resolver(items.listarBloqueantesAbiertos, [])
  resolver(items.listarBloqueantes, [])
  resolver(items.guardarItem, { id: 99, codigo: 'BL-099', antes: null, cambios: [], sin_cambios: false })
  resolver(items.eliminarItem, 2)
  resolver(items.eliminarNota, null)
  resolver(catalogos.listarCatalogo, [])
  resolver(catalogos.crearRegistro, {})
  resolver(catalogos.actualizarRegistro, {})
  resolver(catalogos.eliminarRegistro, null)
  resolver(personas.listarPersonas, [])
  resolver(personas.guardarPersona, 1)
  resolver(personas.eliminarPersona, null)
  resolver(ceremonias.listarCeremonias, [])
  resolver(ceremonias.listarAcuerdos, [])
  resolver(ceremonias.guardarCeremonia, { id: 1 })
  resolver(ceremonias.eliminarCeremonia, 0)
  resolver(ceremonias.guardarAcuerdo, { id: 1 })
  resolver(ceremonias.eliminarAcuerdo, null)
  resolver(alertas.listarReglas, [])
  resolver(alertas.listarCola, [])
  resolver(alertas.listarProximasAlertas, [])
  resolver(alertas.listarLog, [])
  resolver(alertas.listarAlertasPorRegla, [])
  resolver(alertas.contarAlertas, { pendientes: 0, fallidas: 0, enviadasHoy: 0 })
  resolver(alertas.obtenerCuerpoAlerta, '<p>Vista previa</p>')
  resolver(alertas.actualizarRegla, null)
  resolver(alertas.cancelarAlertas, null)
  resolver(alertas.reintentarAlertas, null)
  resolver(alertas.revisarReglasAhora, { creadas: 1, enviadas: 2, fallidas: 0 })
  resolver(alertas.despacharCola, { enviadas: 1, fallidas: 0 })
  resolver(alertas.notificarItemGuardado, { mensaje: '' })
  resolver(alertas.escalarBloqueo, { ok: true, mensaje: 'Escalamiento enviado.' })
  resolver(alertas.enviarResumenSemanal, { destinatarios: 2, mensaje: 'Resumen enviado a 2 destinatario(s).' })
  resolver(alertas.recordarVencimientos, { correos: 1, mensaje: '1 correo(s) de recordatorio enviados.' })
  resolver(alertas.invitarCeremonia, { destinatarios: 3 })
  resolver(alertas.resolverDestinatarios, [])
  resolver(correo.obtenerConfigCorreo, CONFIG_CORREO)
  resolver(correo.guardarConfigCorreo, CONFIG_CORREO)
  resolver(correo.probarConexionCorreo, { ok: true, detalle: 'Conexión correcta.' })
  resolver(correo.enviarCorreoPrueba, { ok: true, detalle: 'Enviado.' })
  resolver(correo.cambiarModoEnvio, CONFIG_CORREO)
  resolver(ia.obtenerEstadoIa, { disponible: false })
  resolver(ia.redactarConModelo, { texto: 'Texto pulido' })
  resolver(configuracion.obtenerConfiguracion, { po_nombre: 'Verónica', po_correo: 'vero@ises.com.co' })
  resolver(configuracion.guardarConfiguracion, null)
  resolver(configuracion.listarAuditoria, [])
  resolver(configuracion.importarPlan, {
    nuevos: 1, actualizados: 0, sin_cambios: 0, reprogramaciones: 0, notas: 0, personas_nuevas: [],
  })
  resolver(configuracion.leerTabla, [])
  resolver(clickup.obtenerEstadoClickUp, ESTADO_CLICKUP_BASE)
  resolver(clickup.guardarConfigClickUp, ESTADO_CLICKUP_BASE)
  resolver(clickup.probarClickUp, { ok: true, usuario: 'vero@ises.com.co', equipos: [{ id: 't1', nombre: 'Ises' }] })
  resolver(clickup.obtenerJerarquiaClickUp, JERARQUIA_CLICKUP)
  resolver(clickup.registrarWebhookClickUp, { ok: true, webhook_id: 'w1' })
  resolver(clickup.quitarWebhookClickUp, { ok: true })
  resolver(clickup.sincronizarClickUp, { procesadas: 3, errores: 0 })
  resolver(clickup.reconciliarClickUp, { creadas: 1, actualizadas: 2, archivadas: 0 })
  resolver(clickup.importarExistentesClickUp, { importadas: 4 })
  resolver(clickup.listarDestinos, [])
  resolver(clickup.listarTableros, [])
  resolver(clickup.crearTablero, { id: 1, nombre: 'Nuevo', mapeo_estados: null })
  resolver(clickup.actualizarTablero, { id: 1 })
  resolver(clickup.eliminarTablero, null)
  resolver(clickup.guardarDestino, { id: 1 })
  resolver(clickup.eliminarDestino, null)
  resolver(clickup.listarColaClickUp, [])
  resolver(clickup.listarPendientesDeItem, [])
}

export const CONFIG_CORREO_BASE = CONFIG_CORREO
