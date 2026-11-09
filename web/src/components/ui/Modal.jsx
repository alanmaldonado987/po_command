import { useEffect } from 'react'
import { Icon } from './Icon'

export function Modal({ titulo, onCerrar, children }) {
  useEffect(() => {
    const alPresionar = (evento) => evento.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', alPresionar)
    return () => document.removeEventListener('keydown', alPresionar)
  }, [onCerrar])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onMouseDown={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onMouseDown={(evento) => evento.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg animate-fade-in overflow-y-auto rounded-card bg-white p-5 shadow-xl"
      >
        <header className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold">{titulo}</h3>
          <button type="button" onClick={onCerrar} className="rounded-lg p-1 text-ink-muted hover:bg-line-soft" aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
