import { actualizarFila, auditar, encolarClickUp, ErrorApi, cancelarAlertas, eliminarFila, insertar, siguienteId } from './almacen.js'
import { itemsAbiertosVinculadosDe, tableroDeItem } from './clickupDestinos.js'
import { ahoraIso, formatoLatino, hoyIso } from './tiempo.js'
import { vistaItem } from './vistas.js'

const CAMPOS_ITEM = [
  'producto_id', 'cliente_id', 'actividad_id', 'modulo_id', 'funcionalidad', 'descripcion', 'fase', 'alcance', 'responsable_id',
  'plan_ini', 'plan_fin', 'plan_pruebas_ini', 'plan_pruebas_fin', 'real_ini', 'real_fin', 'real_pruebas_ini', 'real_pruebas_fin',
  'estado', 'prioridad', 'bloqueado', 'motivo_bloqueo', 'clave_importacion',
]
const FECHAS_PLAN = {
  plan_ini: 'inicio planificado',
  plan_fin: 'fin planificado',
  plan_pruebas_ini: 'inicio de pruebas planificado',
  plan_pruebas_fin: 'fin de pruebas planificado',
}
const CATEGORIAS_PERSONA_NUEVA = ['Bloqueantes', 'Vencimientos', 'Reprogramaciones', 'Ceremonias']

const limpiar = (texto) => String(texto ?? '').trim().replace(/\s+/g, ' ')

export function normalizar(texto) {
  return limpiar(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function catalogoId(estado, tabla, nombre, productoId = null) {
  const limpio = limpiar(nombre)
  if (!limpio) return null
  const existente = estado[tabla].find((fila) => fila.nombre.toLowerCase() === limpio.toLowerCase())
  if (existente) return existente.id
  return insertar(estado, tabla, tabla === 'modulo' ? { nombre: limpio, producto_id: productoId } : { nombre: limpio }).id
}

function agregarNota(estado, itemId, tipo, texto, autor, fecha = hoyIso()) {
  estado.nota.push({ id: siguienteId(estado, 'nota'), item_id: itemId, tipo, texto, autor, fecha, creado_en: ahoraIso() })
}

function sincronizarBloqueante(estado, item) {
  const abierto = estado.bloqueante.find((b) => b.item_id === item.id && !b.resuelto_en)
  if (item.bloqueado && !abierto) {
    const atraso = vistaItem(estado).find((i) => i.id === item.id)?.atraso_dias ?? 0
    estado.bloqueante.push({
      id: siguienteId(estado, 'bloqueante'), item_id: item.id, motivo: item.motivo_bloqueo, severidad: atraso > 0 ? 'Alta' : 'Media',
      abierto_en: ahoraIso(), escalado_en: null, resuelto_en: null,
    })
    agregarNota(estado, item.id, 'Bloqueo', `Bloqueado: ${item.motivo_bloqueo}`, 'Automática')
  } else if (item.bloqueado) {
    abierto.motivo = item.motivo_bloqueo
  } else if (abierto) {
    abierto.resuelto_en = ahoraIso()
    agregarNota(estado, item.id, 'Bloqueo', `Bloqueo resuelto: ${abierto.motivo}`, 'Automática')
    cancelarAlertas(estado, 'item', item.id, ['BLOQUEO_ESCALAR'])
  }
}

function construirItem(estado, antes, datos) {
  const base = antes ?? { descripcion: '', fase: '', alcance: '', estado: 'No iniciado', prioridad: null, bloqueado: false, motivo_bloqueo: '', terminado_en: null }
  const nuevo = { ...base }
  CAMPOS_ITEM.forEach((campo) => {
    if (campo in datos) nuevo[campo] = datos[campo] ?? null
  })
  if ('producto' in datos) nuevo.producto_id = catalogoId(estado, 'producto', datos.producto)
  if ('cliente' in datos) nuevo.cliente_id = catalogoId(estado, 'cliente', datos.cliente)
  if ('actividad' in datos) nuevo.actividad_id = catalogoId(estado, 'actividad', datos.actividad)
  if ('modulo' in datos) nuevo.modulo_id = catalogoId(estado, 'modulo', datos.modulo, nuevo.producto_id)

  nuevo.funcionalidad = limpiar(nuevo.funcionalidad)
  if (!nuevo.funcionalidad) throw new ErrorApi('La funcionalidad es obligatoria')
  nuevo.descripcion ??= ''
  nuevo.fase ??= ''
  nuevo.alcance ??= ''
  nuevo.estado ??= 'No iniciado'
  nuevo.bloqueado = Boolean(nuevo.bloqueado)
  if (!nuevo.bloqueado) nuevo.motivo_bloqueo = ''
  else nuevo.motivo_bloqueo = limpiar(nuevo.motivo_bloqueo) || 'Motivo pendiente: complétalo en el backlog'

  if (nuevo.estado !== 'Terminado') nuevo.terminado_en = null
  else if (antes?.estado === 'Terminado' && antes.terminado_en) nuevo.terminado_en = antes.terminado_en
  else nuevo.terminado_en = nuevo.real_pruebas_fin ?? nuevo.real_fin ?? hoyIso()
  return nuevo
}

const sinMarcaDeTiempo = ({ actualizado_en: _ignorado, ...resto }) => resto

function cambiosDeFechas(antes, nuevo) {
  return Object.keys(FECHAS_PLAN)
    .filter((campo) => (antes[campo] ?? null) !== (nuevo[campo] ?? null))
    .map((campo) => ({ campo, antes: antes[campo] ?? null, despues: nuevo[campo] ?? null }))
}

export function guardarItem(estado, { p_data: datos, p_id: id = null, p_nota: nota = '', p_tipo_nota: tipoNota = 'Seguimiento', p_autor: autor = '' }) {
  const permitidos = Object.fromEntries(Object.entries(datos).filter(([clave]) => !['id', 'creado_en', 'actualizado_en', 'eliminado_en', 'terminado_en'].includes(clave)))
  const antes = id ? estado.item.find((item) => item.id === id && !item.eliminado_en) : null
  if (id && !antes) throw new ErrorApi(`El ítem ${id} no existe`)
  if (antes) delete permitidos.codigo

  const nuevo = construirItem(estado, antes, permitidos)
  const resumenAntes = antes ? { bloqueado: antes.bloqueado, motivo_bloqueo: antes.motivo_bloqueo } : null

  const tableroAnterior = antes ? tableroDeItem(estado, antes) : null
  if (antes) {
    if (JSON.stringify(sinMarcaDeTiempo(antes)) === JSON.stringify(sinMarcaDeTiempo({ ...antes, ...nuevo })) && !limpiar(nota)) {
      return { id: antes.id, codigo: antes.codigo, antes: resumenAntes, cambios: [], sin_cambios: true }
    }
    const cambios = cambiosDeFechas(antes, nuevo)
    actualizarFila(estado, 'item', antes, { ...nuevo, actualizado_en: ahoraIso() })
    if (cambios.length) {
      const texto = cambios.map((c) => `${FECHAS_PLAN[c.campo]}: ${formatoLatino(c.antes)} → ${formatoLatino(c.despues)}`).join('; ')
      agregarNota(estado, antes.id, 'Reprogramación', `Cambio de fechas · ${texto}`, 'Automática')
    }
    if (limpiar(nota)) agregarNota(estado, antes.id, tipoNota, nota.trim(), autor)
    sincronizarBloqueante(estado, antes)
    encolarClickUp(estado, antes.id, 'update')
    if (antes.clickup_task_id && tableroDeItem(estado, antes) !== tableroAnterior) encolarClickUp(estado, antes.id, 'mover')
    return { id: antes.id, codigo: antes.codigo, antes: resumenAntes, cambios, sin_cambios: false }
  }

  const codigo = limpiar(permitidos.codigo) || `BL-${String(siguienteId(estado, 'item')).padStart(3, '0')}`
  const creado = insertar(estado, 'item', { ...nuevo, codigo, creado_en: ahoraIso(), actualizado_en: ahoraIso(), eliminado_en: null })
  if (limpiar(nota)) agregarNota(estado, creado.id, tipoNota, nota.trim(), autor)
  sincronizarBloqueante(estado, creado)
  encolarClickUp(estado, creado.id, 'create')
  return { id: creado.id, codigo, antes: null, cambios: [], sin_cambios: false }
}

export function eliminarItem(estado, { p_id: id }) {
  const item = estado.item.find((fila) => fila.id === id && !fila.eliminado_en)
  if (!item) throw new ErrorApi(`El ítem ${id} no existe`)
  item.eliminado_en = ahoraIso()
  auditar(estado, 'item', id, 'eliminar', `${item.codigo} ${item.funcionalidad}`)
  encolarClickUp(estado, id, 'archive')
  estado.bloqueante.filter((b) => b.item_id === id && !b.resuelto_en).forEach((b) => { b.resuelto_en = ahoraIso() })
  return cancelarAlertas(estado, 'item', id)
}

export function eliminarCeremonia(estado, { p_id: id }) {
  const canceladas = cancelarAlertas(estado, 'ceremonia', id)
  const ceremonia = estado.ceremonia.find((fila) => fila.id === id)
  if (ceremonia) eliminarFila(estado, 'ceremonia', ceremonia)
  return canceladas
}

export function guardarPersona(estado, { p_data: datos, p_clientes: clientes = [], p_id: id = null }) {
  const nombre = limpiar(datos.nombre)
  if (!nombre) throw new ErrorApi('El nombre es obligatorio')
  const campos = {
    nombre, correo: String(datos.correo ?? '').trim(), tipo: datos.tipo, rol: datos.rol ?? '',
    frecuencia_reporte: datos.frecuencia_reporte ?? '', recibe: datos.recibe ?? [], activo: datos.activo ?? true,
  }
  campos.tablero_id = datos.tablero_id ?? null
  const existente = id ? estado.persona.find((p) => p.id === id) : null
  const tableroAnterior = existente?.tablero_id ?? null
  const persona = existente ? actualizarFila(estado, 'persona', existente, campos) : insertar(estado, 'persona', campos)
  if (existente && campos.tablero_id !== tableroAnterior) {
    itemsAbiertosVinculadosDe(estado, persona.id).forEach((item) => encolarClickUp(estado, item.id, 'mover'))
  }
  estado.persona_cliente = estado.persona_cliente.filter((pc) => pc.persona_id !== persona.id)
  clientes.forEach((clienteId) => estado.persona_cliente.push({ persona_id: persona.id, cliente_id: clienteId }))
  return persona.id
}

export function importarPlan(estado, { p_filas: filas, p_simular: simular = false, p_producto: producto = 'FieldOps' }) {
  const resultado = { filas: filas.length, nuevos: 0, actualizados: 0, sin_cambios: 0, reprogramaciones: 0, notas: 0, personas_nuevas: [] }
  filas.forEach((fila) => {
    const existente = estado.item.find((item) => item.clave_importacion === fila.clave && !item.eliminado_en)
    let responsable = null
    if (fila.responsable) {
      responsable = estado.persona.find((p) => normalizar(p.nombre) === normalizar(fila.responsable))?.id ?? null
      if (!responsable) {
        resultado.personas_nuevas.push(fila.responsable)
        if (!simular) {
          responsable = insertar(estado, 'persona', { nombre: fila.responsable, tipo: 'equipo', rol: 'Developer', recibe: CATEGORIAS_PERSONA_NUEVA }).id
        }
      }
    }
    if (simular) {
      resultado[existente ? 'actualizados' : 'nuevos'] += 1
      return
    }
    const datos = {
      cliente: fila.cliente, actividad: fila.actividad, modulo: fila.modulo, funcionalidad: fila.funcionalidad, fase: fila.fase,
      alcance: fila.alcance, responsable_id: responsable, clave_importacion: fila.clave,
      ...Object.fromEntries(['plan_ini', 'plan_fin', 'plan_pruebas_ini', 'plan_pruebas_fin', 'real_ini', 'real_fin', 'real_pruebas_ini', 'real_pruebas_fin'].map((c) => [c, fila[c] ?? null])),
    }
    if (fila.producto) datos.producto = fila.producto
    else if (!existente) datos.producto = producto
    if (!(fila.estado_deducido && existente)) datos.estado = fila.estado
    const guardado = guardarItem(estado, { p_data: datos, p_id: existente?.id ?? null, p_autor: 'Importación' })
    if (!existente) resultado.nuevos += 1
    else if (guardado.sin_cambios) resultado.sin_cambios += 1
    else {
      resultado.actualizados += 1
      if (guardado.cambios.length) resultado.reprogramaciones += 1
    }
    ;[['Planificación', fila.consid_plan], ['Ejecución', fila.consid_real]].forEach(([tipo, notas]) => {
      ;(notas ?? []).forEach(({ texto, fecha }) => {
        const repetida = estado.nota.some((n) => n.item_id === guardado.id && normalizar(n.texto) === normalizar(texto))
        if (repetida) return
        agregarNota(estado, guardado.id, tipo, texto, 'Importación', fecha ?? hoyIso())
        resultado.notas += 1
      })
    })
  })
  resultado.personas_nuevas = [...new Set(resultado.personas_nuevas)]
  if (!simular) auditar(estado, 'importacion', null, 'importar', `${resultado.nuevos} nuevos, ${resultado.actualizados} actualizados, ${resultado.notas} notas`)
  return resultado
}

export const RPC = {
  guardar_item: guardarItem,
  eliminar_item: eliminarItem,
  eliminar_ceremonia: eliminarCeremonia,
  guardar_persona: guardarPersona,
  importar_plan: importarPlan,
}
