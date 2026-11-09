import { useCallback, useEffect, useRef, useState } from 'react'
import { cx } from '../../lib/cx'
import { useClickOutside } from '../../hooks/useClickOutside'

export function Popover({ renderTrigger, align = 'left', className, children }) {
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef(null)
  const cerrar = useCallback(() => setAbierto(false), [])
  useClickOutside(contenedor, cerrar)

  useEffect(() => {
    if (!abierto) return undefined
    const alPresionar = (evento) => evento.key === 'Escape' && cerrar()
    document.addEventListener('keydown', alPresionar)
    return () => document.removeEventListener('keydown', alPresionar)
  }, [abierto, cerrar])

  return (
    <div ref={contenedor} className="relative">
      {renderTrigger({ abierto, alternar: () => setAbierto((valor) => !valor) })}
      {abierto && (
        <div
          className={cx(
            'absolute z-30 mt-1.5 min-w-full animate-fade-in rounded-xl border border-line bg-white p-3 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {typeof children === 'function' ? children({ cerrar }) : children}
        </div>
      )}
    </div>
  )
}
