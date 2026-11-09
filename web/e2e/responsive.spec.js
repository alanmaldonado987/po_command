import { abrir, expect, test } from './support/fixtures.js'

const RUTAS = ['/', '/backlog', '/cronograma', '/ceremonias', '/equipo', '/alertas', '/analitica', '/asistente', '/configuracion']

const esMovil = () => test.info().project.name === 'movil'
const menuAbierto = (page) => page.locator('aside').evaluate((aside) => aside.getBoundingClientRect().right > 0)

async function esperarCarga(page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('Cargando…')).toHaveCount(0)
}

test.describe('Responsive · móvil', () => {
  test.beforeEach(() => {
    test.skip(!esMovil(), 'Solo aplica al proyecto móvil')
  })

  test('el menú lateral está oculto y se abre con la hamburguesa', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/')
    await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible()
    await expect.poll(() => menuAbierto(page)).toBe(false)
    await page.getByRole('button', { name: 'Abrir menú' }).click()
    await expect(page.locator('aside').getByRole('link', { name: 'Backlog · Plan de Trabajo' })).toBeVisible()
    await expect.poll(() => menuAbierto(page)).toBe(true)
  })

  test('navegar desde el menú cierra el panel', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/')
    await page.getByRole('button', { name: 'Abrir menú' }).click()
    await page.locator('aside').getByRole('link', { name: 'Cronograma', exact: true }).click()
    await expect(page).toHaveURL(/\/cronograma$/)
    await expect.poll(() => menuAbierto(page)).toBe(false)
  })

  test('pulsar el fondo oscuro cierra el menú', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/')
    await page.getByRole('button', { name: 'Abrir menú' }).click()
    await page.mouse.click(380, 400)
    await expect.poll(() => menuAbierto(page)).toBe(false)
  })

  test('cerrar sesión funciona desde el menú móvil', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/')
    await page.getByRole('button', { name: 'Abrir menú' }).click()
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  for (const ruta of RUTAS) {
    test(`${ruta} no genera desplazamiento horizontal de la página`, async ({ paginaAutenticada: page }) => {
      await page.goto(ruta)
      await esperarCarga(page)
      const { ancho, visible } = await page.evaluate(() => ({ ancho: document.documentElement.scrollWidth, visible: window.innerWidth }))
      expect(ancho).toBeLessThanOrEqual(visible + 1)
    })
  }

  test('el Gantt y las tablas desplazan dentro de su contenedor', async ({ paginaAutenticada: page }) => {
    await page.goto('/cronograma')
    await esperarCarga(page)
    const contenedor = page.locator('div.overflow-x-auto').first()
    const { scroll, cliente } = await contenedor.evaluate((e) => ({ scroll: e.scrollWidth, cliente: e.clientWidth }))
    expect(scroll).toBeGreaterThan(cliente)
  })

  test('los formularios se apilan en una columna', async ({ paginaAutenticada: page }) => {
    await page.goto('/backlog')
    await page.getByRole('button', { name: 'Nuevo ítem' }).click()
    const cliente = await page.getByLabel('Cliente *').boundingBox()
    const actividad = await page.getByLabel('Actividad *').boundingBox()
    expect(Math.abs(cliente.x - actividad.x)).toBeLessThan(2)
  })
})

test.describe('Responsive · escritorio y tableta', () => {
  test.beforeEach(() => {
    test.skip(esMovil(), 'Solo aplica al proyecto de escritorio')
  })

  test('en escritorio el menú lateral es fijo y no hay hamburguesa', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/')
    await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeHidden()
    await expect.poll(() => menuAbierto(page)).toBe(true)
  })

  test.describe('tableta', () => {
    test.use({ viewport: { width: 800, height: 1000 } })

    test('en tableta se usa el menú desplegable', async ({ paginaAutenticada: page }) => {
      await abrir(page, '/')
      await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible()
      await expect.poll(() => menuAbierto(page)).toBe(false)
    })

    test('ninguna página desborda horizontalmente en tableta', async ({ paginaAutenticada: page }) => {
      for (const ruta of RUTAS) {
        await page.goto(ruta)
        await esperarCarga(page)
        const { ancho, visible } = await page.evaluate(() => ({ ancho: document.documentElement.scrollWidth, visible: window.innerWidth }))
        expect(ancho, `desborde en ${ruta}`).toBeLessThanOrEqual(visible + 1)
      }
    })
  })
})
