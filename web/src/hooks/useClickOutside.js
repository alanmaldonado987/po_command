import { useEffect } from 'react'

export function useClickOutside(referencia, alSalir) {
  useEffect(() => {
    const alPresionar = (evento) => {
      if (referencia.current && !referencia.current.contains(evento.target)) alSalir()
    }
    document.addEventListener('mousedown', alPresionar)
    return () => document.removeEventListener('mousedown', alPresionar)
  }, [referencia, alSalir])
}
