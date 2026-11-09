import { describe, expect, it } from 'vitest'
import { RUTAS, SECCIONES } from './routes'

describe('routes', () => {
  it('define las nueve páginas de la aplicación', () => {
    expect(RUTAS.map((r) => r.ruta)).toEqual([
      '/', '/backlog', '/cronograma', '/ceremonias', '/equipo', '/alertas', '/analitica', '/asistente', '/configuracion',
    ])
  })

  it('cada ruta tiene título, icono y página', () => {
    RUTAS.forEach(({ titulo, icono, pagina }) => {
      expect(titulo).toBeTruthy()
      expect(icono).toBeTruthy()
      expect(pagina).toBeDefined()
    })
  })

  it('las rutas son únicas y están agrupadas en tres secciones', () => {
    expect(new Set(RUTAS.map((r) => r.ruta)).size).toBe(RUTAS.length)
    expect(SECCIONES.map((s) => s.titulo)).toEqual(['Operación', 'Personas y avisos', 'Análisis'])
  })
})
