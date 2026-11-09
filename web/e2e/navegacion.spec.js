import { ESPERADO } from './support/datosSemilla.js'
import { expect, test } from './support/fixtures.js'

const PAGINAS = [
  ['Centro de Mando', '/', 'Centro de Mando'],
  ['Backlog · Plan de Trabajo', '/backlog', 'Ítems del backlog'],
  ['Cronograma', '/cronograma', 'Planificado frente a ejecutado'],
  ['Demos & Ceremonias', '/ceremonias', 'Agenda de seguimiento'],
  ['Equipo & Stakeholders', '/equipo', 'Directorio y preferencias de aviso'],
  ['Alertas & Notificaciones', '/alertas', 'Reglas de alerta'],
  ['Analítica', '/analitica', 'Cumplimiento del plan de trabajo'],
  ['IA Asistente', '/asistente', 'Tu copiloto de PO'],
  ['Configuración & Datos', '/configuracion', 'Base de datos y motor de alertas'],
]

test.describe('Navegación lateral', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name === 'movil', 'La barra lateral fija es solo de escritorio')
  })

  test('cada enlace abre su página y marca la ruta activa', async ({ paginaAutenticada: page }) => {
    await page.goto('/')
    const lateral = page.locator('aside')
    for (const [enlace, ruta, titulo] of PAGINAS) {
      await lateral.getByRole('link', { name: enlace, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${ruta === '/' ? '/$' : `${ruta}$`}`))
      await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible()
      await expect(lateral.getByRole('link', { name: enlace, exact: true })).toHaveAttribute('aria-current', 'page')
    }
  })

  test('las secciones del menú están agrupadas', async ({ paginaAutenticada: page }) => {
    await page.goto('/')
    const lateral = page.locator('aside')
    for (const seccion of ['Operación', 'Personas y avisos', 'Análisis']) {
      await expect(lateral.getByRole('button', { name: seccion, exact: true })).toBeVisible()
    }
  })

  test('el resumen lateral refleja los datos', async ({ paginaAutenticada: page }) => {
    await page.goto('/')
    const lateral = page.locator('aside')
    const fila = (etiqueta) => lateral.getByText(etiqueta, { exact: true }).locator('xpath=..')
    await expect(fila('Ítems abiertos')).toContainText(String(ESPERADO.abiertos))
    await expect(fila('Atrasados')).toContainText(String(ESPERADO.atrasados))
    await expect(fila('Bloqueantes')).toContainText(String(ESPERADO.bloqueantes))
    await expect(fila('Alertas en cola')).toContainText(String(ESPERADO.alertasEnCola))
    await expect(fila('Correo')).toContainText('Simulación')
    await expect(lateral).toContainText(`Plan de Trabajo · ${ESPERADO.items} ítems`)
  })
})

test.describe('Menú lateral · contraer y plegar', () => {
  test('una sección se pliega y se vuelve a desplegar', async ({ paginaAutenticada: page }) => {
    await page.goto('/')
    const lateral = page.locator('aside')
    const seccion = lateral.getByRole('button', { name: 'Operación', exact: true })
    await expect(seccion).toHaveAttribute('aria-expanded', 'true')
    await seccion.click()
    await expect(seccion).toHaveAttribute('aria-expanded', 'false')
    await expect(lateral.getByRole('link', { name: 'Cronograma', exact: true })).toBeHidden()
    await seccion.click()
    await expect(lateral.getByRole('link', { name: 'Cronograma', exact: true })).toBeVisible()
  })

  test('el menú se contrae a iconos y recuerda la preferencia', async ({ paginaAutenticada: page }, info) => {
    test.skip(info.project.name !== 'desktop')
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    const lateral = page.locator('aside')
    await expect.poll(async () => (await lateral.boundingBox()).width).toBeGreaterThan(250)
    await page.getByRole('button', { name: 'Contraer menú' }).click()
    await expect.poll(async () => (await lateral.boundingBox()).width).toBeLessThan(100)
    await page.reload()
    await expect.poll(async () => (await lateral.boundingBox()).width).toBeLessThan(100)
    await page.getByRole('button', { name: 'Expandir menú' }).click()
    await expect.poll(async () => (await lateral.boundingBox()).width).toBeGreaterThan(250)
  })
})
