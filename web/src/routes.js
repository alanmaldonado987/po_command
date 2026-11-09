import { lazy } from 'react'

export const SECCIONES = [
  {
    titulo: 'Operación',
    rutas: [
      { ruta: '/', titulo: 'Centro de Mando', icono: 'space_dashboard', pagina: lazy(() => import('./pages/CentroMando')) },
      { ruta: '/backlog', titulo: 'Backlog · Plan de Trabajo', icono: 'list_alt', pagina: lazy(() => import('./pages/Backlog')) },
      { ruta: '/cronograma', titulo: 'Cronograma', icono: 'date_range', pagina: lazy(() => import('./pages/Cronograma')) },
      { ruta: '/ceremonias', titulo: 'Demos & Ceremonias', icono: 'event', pagina: lazy(() => import('./pages/Ceremonias')) },
    ],
  },
  {
    titulo: 'Personas y avisos',
    rutas: [
      { ruta: '/equipo', titulo: 'Equipo & Stakeholders', icono: 'group', pagina: lazy(() => import('./pages/Equipo')) },
      { ruta: '/alertas', titulo: 'Alertas & Notificaciones', icono: 'notifications', pagina: lazy(() => import('./pages/Alertas')) },
    ],
  },
  {
    titulo: 'Análisis',
    rutas: [
      { ruta: '/analitica', titulo: 'Analítica', icono: 'bar_chart', pagina: lazy(() => import('./pages/Analitica')) },
      { ruta: '/asistente', titulo: 'IA Asistente', icono: 'auto_awesome', pagina: lazy(() => import('./pages/Asistente')) },
      { ruta: '/configuracion', titulo: 'Configuración & Datos', icono: 'database', pagina: lazy(() => import('./pages/Configuracion')) },
    ],
  },
]

export const RUTAS = SECCIONES.flatMap((seccion) => seccion.rutas)
