import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const MENSAJES_AUTH = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'El usuario no está confirmado. Confírmalo en Authentication → Users de Supabase.',
}

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => setSesion(nuevaSesion))
    return () => data.subscription.unsubscribe()
  }, [])

  const valor = useMemo(
    () => ({
      sesion,
      cargando,
      iniciarSesion: async (correo, clave) => {
        const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave })
        if (error) throw new Error(MENSAJES_AUTH[error.code] ?? error.message)
      },
      cerrarSesion: () => supabase.auth.signOut(),
    }),
    [sesion, cargando],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return contexto
}
