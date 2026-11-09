import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Alert } from '../components/ui/Alert'

const ToastContext = createContext(null)
const DURACION_MS = 4500

export function ToastProvider({ children }) {
  const [mensajes, setMensajes] = useState([])

  const notificar = useCallback((texto, tono = 'exito') => {
    const id = crypto.randomUUID()
    setMensajes((actuales) => [...actuales, { id, texto, tono }])
    setTimeout(() => setMensajes((actuales) => actuales.filter((mensaje) => mensaje.id !== id)), DURACION_MS)
  }, [])

  const valor = useMemo(() => ({ notificar }), [notificar])

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        {mensajes.map(({ id, texto, tono }) => (
          <Alert key={id} tono={tono} className="animate-fade-in bg-white shadow-lg">
            {texto}
          </Alert>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const contexto = useContext(ToastContext)
  if (!contexto) throw new Error('useToast debe usarse dentro de ToastProvider')
  return contexto.notificar
}
