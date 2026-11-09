import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Alert, Button, TextField } from '../components/ui'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { sesion, iniciarSesion } = useAuth()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (sesion) return <Navigate to="/" replace />

  const enviar = async (evento) => {
    evento.preventDefault()
    setEnviando(true)
    setError('')
    try {
      await iniciarSesion(correo.trim(), clave)
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink p-4">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-4 rounded-hero bg-white p-7 shadow-xl">
        <img src="/logo.png" alt="PO Command Center" className="h-10" />
        <div>
          <h1 className="text-xl font-extrabold">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-ink-muted">Accede a tu centro de control como Product Owner.</p>
        </div>
        {error && <Alert tono="error">{error}</Alert>}
        <TextField label="Correo" type="email" autoComplete="email" required value={correo} onChange={setCorreo} />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={clave}
          onChange={setClave}
        />
        <Button type="submit" variant="primary" full loading={enviando}>
          Entrar
        </Button>
      </form>
    </main>
  )
}
