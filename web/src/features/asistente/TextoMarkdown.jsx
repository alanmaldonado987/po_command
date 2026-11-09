const MARCAS = /(\*\*[^*]+\*\*|\*[^*]+\*)/g

function Inline({ texto }) {
  return texto.split(MARCAS).map((trozo, indice) => {
    if (trozo.startsWith('**')) return <strong key={indice}>{trozo.slice(2, -2)}</strong>
    if (trozo.startsWith('*') && trozo.length > 2) return <em key={indice}>{trozo.slice(1, -1)}</em>
    return trozo
  })
}

const esLista = (linea) => /^\s*- /.test(linea)

function agruparBloques(lineas) {
  const bloques = []
  lineas.forEach((linea) => {
    const tipo = esLista(linea) ? 'lista' : 'parrafo'
    const ultimo = bloques[bloques.length - 1]
    if (!linea.trim()) return bloques.push({ tipo: 'espacio' })
    if (ultimo?.tipo === tipo && tipo === 'lista') ultimo.lineas.push(linea)
    else if (ultimo?.tipo === 'parrafo' && tipo === 'parrafo') ultimo.lineas.push(linea)
    else bloques.push({ tipo, lineas: [linea] })
  })
  return bloques.filter((bloque) => bloque.tipo !== 'espacio')
}

export function TextoMarkdown({ texto }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-ink-soft">
      {agruparBloques(texto.split('\n')).map((bloque, indice) =>
        bloque.tipo === 'lista' ? (
          <ul key={indice} className="space-y-1">
            {bloque.lineas.map((linea, posicion) => (
              <li
                key={posicion}
                className="flex gap-2"
                style={{ paddingLeft: `${(linea.match(/^\s*/)[0].length / 2) * 16}px` }}
              >
                <span className="text-ink-muted">•</span>
                <span>
                  <Inline texto={linea.replace(/^\s*- /, '')} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={indice}>
            {bloque.lineas.map((linea, posicion) => (
              <span key={posicion}>
                {posicion > 0 && <br />}
                <Inline texto={linea} />
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  )
}
