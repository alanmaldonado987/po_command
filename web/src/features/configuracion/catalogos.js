export const CAMPOS_EXTRA = {
  cliente: ['estado'],
  actividad: [],
  modulo: ['producto_id'],
  producto: ['estado'],
}

export const COLUMNA_ITEM = {
  cliente: 'cliente_id',
  actividad: 'actividad_id',
  modulo: 'modulo_id',
  producto: 'producto_id',
}

export const BORRADOR_VACIO = { nombre: '', descripcion: '', estado: 'Activo', producto_id: null }

export function aBorrador(registro) {
  return registro ? { ...BORRADOR_VACIO, ...registro, descripcion: registro.descripcion ?? '' } : BORRADOR_VACIO
}

export function aDatosCatalogo(tabla, borrador) {
  const extras = Object.fromEntries(CAMPOS_EXTRA[tabla].map((campo) => [campo, borrador[campo]]))
  return { nombre: borrador.nombre.trim(), descripcion: borrador.descripcion, ...extras }
}

export function contarUsos(items, tabla) {
  return items.reduce((usos, item) => {
    const id = item[COLUMNA_ITEM[tabla]]
    if (id != null) usos[id] = (usos[id] ?? 0) + 1
    return usos
  }, {})
}

export const mensajeDeError = (error) =>
  /duplicate key|unique/i.test(error.message) ? 'Ya existe un registro con ese nombre.' : error.message
