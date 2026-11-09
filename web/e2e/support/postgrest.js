const PARAMETROS_RESERVADOS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

const comoNumero = (valor) => (valor !== '' && valor !== null && !Number.isNaN(Number(valor)) ? Number(valor) : null)

function comparar(valorFila, valorFiltro) {
  const numeroFila = typeof valorFila === 'number' ? valorFila : null
  const numeroFiltro = comoNumero(valorFiltro)
  if (numeroFila !== null && numeroFiltro !== null) return numeroFila - numeroFiltro
  return String(valorFila).localeCompare(String(valorFiltro))
}

function analizarLista(texto) {
  return texto
    .replace(/^\(|\)$/g, '')
    .split(',')
    .map((parte) => parte.replace(/^"|"$/g, ''))
}

function evaluar(valorFila, operador, argumento) {
  const nulo = valorFila === null || valorFila === undefined
  switch (operador) {
    case 'eq': return !nulo && String(valorFila) === argumento
    case 'neq': return nulo || String(valorFila) !== argumento
    case 'gt': return !nulo && comparar(valorFila, argumento) > 0
    case 'gte': return !nulo && comparar(valorFila, argumento) >= 0
    case 'lt': return !nulo && comparar(valorFila, argumento) < 0
    case 'lte': return !nulo && comparar(valorFila, argumento) <= 0
    case 'in': return !nulo && analizarLista(argumento).includes(String(valorFila))
    case 'is': return argumento === 'null' ? nulo : String(valorFila) === argumento
    case 'ilike': return !nulo && new RegExp(`^${argumento.replace(/%/g, '.*')}$`, 'i').test(String(valorFila))
    default: throw new Error(`Operador PostgREST no soportado en el fake: ${operador}`)
  }
}

function crearPredicado(columna, expresion) {
  const negado = expresion.startsWith('not.')
  const sinNegar = negado ? expresion.slice(4) : expresion
  const punto = sinNegar.indexOf('.')
  const operador = sinNegar.slice(0, punto)
  const argumento = sinNegar.slice(punto + 1)
  return (fila) => evaluar(fila[columna], operador, argumento) !== negado
}

export function aplicarFiltros(filas, parametros) {
  const predicados = [...parametros.entries()]
    .filter(([clave]) => !PARAMETROS_RESERVADOS.has(clave))
    .map(([columna, expresion]) => crearPredicado(columna, expresion))
  return filas.filter((fila) => predicados.every((predicado) => predicado(fila)))
}

export function aplicarOrden(filas, parametros) {
  const orden = parametros.get('order')
  if (!orden) return filas
  const criterios = orden.split(',').map((criterio) => {
    const [columna, direccion = 'asc', nulos] = criterio.split('.')
    return { columna, descendente: direccion === 'desc', nulosPrimero: nulos ? nulos === 'nullsfirst' : direccion === 'desc' }
  })
  return [...filas].sort((a, b) => {
    for (const { columna, descendente, nulosPrimero } of criterios) {
      const x = a[columna]
      const y = b[columna]
      const nuloX = x === null || x === undefined
      const nuloY = y === null || y === undefined
      if (nuloX || nuloY) {
        if (nuloX && nuloY) continue
        return nuloX === nulosPrimero ? -1 : 1
      }
      const resultado = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es')
      if (resultado !== 0) return descendente ? -resultado : resultado
    }
    return 0
  })
}

export function aplicarPaginacion(filas, parametros) {
  const desde = Number(parametros.get('offset') ?? 0)
  const limite = parametros.get('limit')
  return filas.slice(desde, limite ? desde + Number(limite) : undefined)
}

export function proyectar(filas, parametros) {
  const seleccion = parametros.get('select') ?? '*'
  if (seleccion === '*') return filas
  const columnas = seleccion.split(',').map((columna) => columna.trim())
  return filas.map((fila) => Object.fromEntries(columnas.map((columna) => [columna, fila[columna]])))
}
