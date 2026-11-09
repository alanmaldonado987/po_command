import { CAMPOS_FECHA } from '../../lib/constantes'
import { limpiar } from '../../lib/texto'

const CAMPOS_FECHAS = Object.keys(CAMPOS_FECHA)

const TRAMOS = [
  ['desarrollo planificado', 'plan_ini', 'plan_fin'],
  ['pruebas planificadas', 'plan_pruebas_ini', 'plan_pruebas_fin'],
  ['desarrollo ejecutado', 'real_ini', 'real_fin'],
  ['pruebas ejecutadas', 'real_pruebas_ini', 'real_pruebas_fin'],
]

export function valoresIniciales(base) {
  return {
    producto: base?.producto ?? 'FieldOps',
    cliente: base?.cliente ?? '',
    actividad: base?.actividad ?? '',
    modulo: base?.modulo ?? '',
    funcionalidad: base?.funcionalidad ?? '',
    descripcion: base?.descripcion ?? '',
    fase: base?.fase ?? 'Desarrollo',
    alcance: base?.alcance ?? '',
    responsable_id: base?.responsable_id ?? null,
    estado: base?.estado ?? 'No iniciado',
    prioridad: base?.prioridad ?? null,
    ...Object.fromEntries(CAMPOS_FECHAS.map((campo) => [campo, base?.[campo] ?? null])),
    tipoNota: 'Seguimiento',
    nota: '',
    bloqueado: false,
    motivo_bloqueo: '',
  }
}

export function valoresDeItem(item) {
  return { ...valoresIniciales(item), bloqueado: item.bloqueado, motivo_bloqueo: item.motivo_bloqueo }
}

export function validar(valores) {
  const errores = []
  const obligatorios = ['cliente', 'actividad', 'modulo', 'funcionalidad', 'alcance']
  if (obligatorios.some((campo) => !limpiar(valores[campo]))) {
    errores.push('Completa los campos con *: cliente, actividad, módulo, funcionalidad y alcance.')
  }
  TRAMOS.forEach(([nombre, inicio, fin]) => {
    if (valores[inicio] && valores[fin] && valores[fin] < valores[inicio]) {
      errores.push(`En ${nombre} la fecha fin es anterior a la de inicio.`)
    }
  })
  if (valores.bloqueado && !valores.motivo_bloqueo.trim()) {
    errores.push('Indica el motivo del bloqueo: se incluye en el correo de alerta.')
  }
  return errores
}

export function aDatosItem(valores) {
  return {
    producto: limpiar(valores.producto),
    cliente: limpiar(valores.cliente),
    actividad: limpiar(valores.actividad),
    modulo: limpiar(valores.modulo),
    funcionalidad: valores.funcionalidad,
    descripcion: valores.descripcion,
    fase: valores.fase,
    alcance: valores.alcance,
    responsable_id: valores.responsable_id,
    estado: valores.estado,
    prioridad: valores.prioridad || null,
    ...Object.fromEntries(CAMPOS_FECHAS.map((campo) => [campo, valores[campo]])),
    bloqueado: valores.bloqueado,
    motivo_bloqueo: valores.bloqueado ? valores.motivo_bloqueo.trim() : '',
  }
}
