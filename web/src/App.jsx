import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { LoadingState } from './components/ui'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import { RUTAS } from './routes'

function RutaProtegida({ children }) {
  const { sesion, cargando } = useAuth()
  if (cargando) return <LoadingState />
  return sesion ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RutaProtegida>
            <AppLayout />
          </RutaProtegida>
        }
      >
        {RUTAS.map(({ ruta, pagina: Pagina }) => (
          <Route key={ruta} path={ruta} element={<Pagina />} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
