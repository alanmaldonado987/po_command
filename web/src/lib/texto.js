const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const correoValido = (correo) => EMAIL.test((correo ?? '').trim())

export const limpiar = (texto) => String(texto ?? '').trim().replace(/\s+/g, ' ')

export function normalizar(texto) {
  return limpiar(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function iniciales(nombre) {
  const partes = (nombre || '?').split(/\s+/)
  const primera = partes[0][0]
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primera + ultima).toUpperCase()
}

export const porcentaje = (parte, total) => (total ? (parte / total) * 100 : 0)

export function agrupar(lista, clave) {
  return lista.reduce((grupos, elemento) => {
    const llave = clave(elemento)
    ;(grupos[llave] ??= []).push(elemento)
    return grupos
  }, {})
}

export const valoresUnicos = (lista, campo) =>
  [...new Set(lista.map((e) => e[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
