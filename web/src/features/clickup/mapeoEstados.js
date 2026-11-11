export const aLista = (valor) =>
  (Array.isArray(valor) ? valor : [valor]).filter((nombre) => typeof nombre === 'string' && nombre.trim())

export const aValorMapeo = (lista) => (lista.length > 1 ? lista : (lista[0] ?? ''))

export const dividirEstados = (texto) => [...new Set(texto.split(',').map((nombre) => nombre.trim()).filter(Boolean))]

export const hacerPrincipal = (lista, nombre) => [nombre, ...lista.filter((actual) => actual !== nombre)]
