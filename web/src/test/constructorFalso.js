export function constructorFalso(resultado = { data: [], error: null }) {
  const llamadas = []
  const constructor = new Proxy(() => {}, {
    get(_destino, propiedad) {
      if (propiedad === 'then') return (alResolver, alRechazar) => Promise.resolve(resultado).then(alResolver, alRechazar)
      return (...argumentos) => {
        llamadas.push([propiedad, argumentos])
        return constructor
      }
    },
  })
  const llamada = (metodo) => llamadas.find(([nombre]) => nombre === metodo)?.[1]
  const todas = (metodo) => llamadas.filter(([nombre]) => nombre === metodo).map(([, args]) => args)
  return { constructor, llamadas, llamada, todas }
}
