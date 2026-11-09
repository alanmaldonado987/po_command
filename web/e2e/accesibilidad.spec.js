import { abrir, expect, test } from './support/fixtures.js'

const RUTAS = ['/', '/backlog', '/cronograma', '/ceremonias', '/equipo', '/alertas', '/analitica', '/asistente', '/configuracion']

async function exigirNombreAccesible(page, selector) {
  const controles = page.locator(selector)
  const total = await controles.count()
  expect(total).toBeGreaterThan(0)
  for (let i = 0; i < total; i += 1) await expect(controles.nth(i)).toHaveAccessibleName(/.+/)
}

test.describe('Accesibilidad · estructura', () => {
  test('la página tiene los puntos de referencia principales', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/')
    await expect(page.getByRole('main')).toHaveCount(1)
    await expect(page.getByRole('navigation')).toHaveCount(1)
    await expect(page.getByRole('complementary')).toHaveCount(1)
    await expect(page.getByRole('img', { name: 'PO Command Center' })).toBeVisible()
  })

  test('cada página tiene exactamente un encabezado principal', async ({ paginaAutenticada: page }) => {
    for (const ruta of RUTAS) {
      await page.goto(ruta)
      await expect(page.getByRole('heading', { level: 1 }), `h1 en ${ruta}`).toHaveCount(1)
    }
  })

  test('el idioma del documento es español', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  })

  test('los campos del login tienen etiqueta', async ({ paginaAnonima: page }) => {
    await page.goto('/login')
    await exigirNombreAccesible(page, 'input')
  })

  test('los campos del formulario de ítems tienen nombre accesible', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/backlog')
    await page.getByRole('button', { name: 'Nuevo ítem' }).click()
    await exigirNombreAccesible(page, 'form input:visible, form select:visible, form textarea:visible')
  })

  test('los campos del editor de personas tienen nombre accesible', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/equipo')
    await page.getByRole('button', { name: 'Agregar persona' }).click()
    await exigirNombreAccesible(page, 'form input:visible, form select:visible, form textarea:visible')
  })

  test('los botones solo con icono tienen nombre accesible', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/ceremonias')
    const botones = page.getByRole('button')
    const total = await botones.count()
    for (let i = 0; i < total; i += 1) await expect(botones.nth(i)).toHaveAccessibleName(/.+/)
  })

  test('las casillas de selección de la cola tienen nombre accesible (H-04)', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/alertas')
    await expect(page.getByText('[Escalamiento] BL-024 AIR-E bloqueado 96 h').first()).toBeVisible()
    await exigirNombreAccesible(page, 'tbody input[type=checkbox]')
  })
})

test.describe('Accesibilidad · teclado', () => {
  test('el login se completa solo con teclado', async ({ paginaAnonima: page }) => {
    await page.goto('/login')
    await page.getByLabel('Correo').focus()
    await page.keyboard.type('po@ises.com.co')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Contraseña')).toBeFocused()
    await page.keyboard.type('secreto-123')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: 'Centro de Mando' })).toBeVisible()
  })

  test('los interruptores se activan con la barra espaciadora', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/cronograma')
    const interruptor = page.getByRole('switch', { name: 'Solo abiertos' })
    await expect(interruptor).toHaveAttribute('aria-checked', 'true')
    await interruptor.focus()
    await page.keyboard.press('Space')
    await expect(interruptor).toHaveAttribute('aria-checked', 'false')
  })

  test('«Más filtros» se despliega con el teclado', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/backlog')
    await page.locator('summary', { hasText: 'Más filtros' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('Módulo / componente')).toBeVisible()
  })

  test('el selector múltiple se abre y marca opciones con el teclado', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/backlog')
    const campo = page.locator('div.block.min-w-0', { has: page.locator('span.field-label', { hasText: /^Cliente$/ }) }).first()
    await campo.getByRole('button').focus()
    await page.keyboard.press('Enter')
    const casilla = campo.getByRole('checkbox', { name: 'ACUACAR' })
    await expect(casilla).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(casilla).toBeFocused()
    await page.keyboard.press('Space')
    await expect(casilla).toBeChecked()
  })

  test('Escape cierra el selector múltiple (H-03)', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/backlog')
    const campo = page.locator('div.block.min-w-0', { has: page.locator('span.field-label', { hasText: /^Cliente$/ }) }).first()
    await campo.getByRole('button').click()
    await expect(campo.getByRole('checkbox', { name: 'AIR-E' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(campo.getByRole('checkbox', { name: 'AIR-E' })).toBeHidden({ timeout: 2000 })
  })

  test('las filas de la tabla del backlog se pueden abrir con el teclado (H-02)', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/backlog')
    const fila = page.getByRole('row').filter({ hasText: 'BL-009' })
    await fila.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 5, name: 'Editar BL-009' })).toBeVisible({ timeout: 2000 })
  })

  test('el foco se mueve de forma lógica por el menú lateral', async ({ paginaAutenticada: page }) => {
    test.skip(test.info().project.name === 'movil', 'El menú es un panel en móvil')
    await abrir(page, '/')
    await page.locator('aside').getByRole('link', { name: 'Centro de Mando' }).focus()
    await page.keyboard.press('Tab')
    await expect(page.locator('aside').getByRole('link', { name: 'Backlog · Plan de Trabajo' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/backlog$/)
  })
})
