import { useEffect, useState } from 'react'

function leer(clave, inicial) {
  try {
    const guardado = window.localStorage.getItem(clave)
    return guardado === null ? inicial : JSON.parse(guardado)
  } catch {
    return inicial
  }
}

export function usePreferencia(clave, inicial) {
  const [valor, setValor] = useState(() => leer(clave, inicial))

  useEffect(() => {
    try {
      window.localStorage.setItem(clave, JSON.stringify(valor))
    } catch {
      // sin almacenamiento disponible: la preferencia solo dura la sesión
    }
  }, [clave, valor])

  return [valor, setValor]
}
