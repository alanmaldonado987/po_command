import { USUARIO_PO, USUARIO_SIN_CONFIRMAR, claveAlmacenSesion } from './support/fakeBackend.js'
import { expect, test } from './support/fixtures.js'

async function iniciarSesion(page, usuario) {
  await page.goto('/login')
  await page.getByLabel('Correo').fill(usuario.email)
  await page.getByLabel('Contraseña').fill(usuario.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test.describe('Inicio de sesión', () => {
  test('credenciales correctas llevan al Centro de Mando y guardan la sesión', async ({ paginaAnonima: page }) => {
    await iniciarSesion(page, USUARIO_PO)
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Centro de Mando' })).toBeVisible()
    const guardada = await page.evaluate((clave) => localStorage.getItem(clave), claveAlmacenSesion())
    expect(JSON.parse(guardada).user.email).toBe(USUARIO_PO.email)
  })

  test('contraseña incorrecta muestra el error y no navega', async ({ paginaAnonima: page }) => {
    await iniciarSesion(page, { ...USUARIO_PO, password: 'equivocada' })
    await expect(page.getByRole('alert')).toContainText('Correo o contraseña incorrectos.')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('usuario sin confirmar recibe un mensaje específico', async ({ paginaAnonima: page }) => {
    await iniciarSesion(page, USUARIO_SIN_CONFIRMAR)
    await expect(page.getByRole('alert')).toContainText('El usuario no está confirmado')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('el formulario exige correo y contraseña', async ({ paginaAnonima: page, backend }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByLabel('Correo')).toHaveJSProperty('validity.valueMissing', true)
    expect(backend.peticionesA('/auth/v1/token')).toHaveLength(0)
  })

  test('el botón queda deshabilitado mientras valida las credenciales', async ({ paginaAnonima: page, backend }) => {
    backend.retardoMs = 600
    await iniciarSesion(page, USUARIO_PO)
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeDisabled()
    await expect(page.getByRole('heading', { level: 1, name: 'Centro de Mando' })).toBeVisible()
  })

  test('las rutas protegidas redirigen al login sin sesión', async ({ paginaAnonima: page }) => {
    for (const ruta of ['/', '/backlog', '/alertas', '/configuracion']) {
      await page.goto(ruta)
      await expect(page).toHaveURL(/\/login$/)
    }
  })

  test('una ruta desconocida vuelve al inicio', async ({ paginaAutenticada: page }) => {
    await page.goto('/no-existe')
    await expect(page).toHaveURL(/\/$/)
  })

  test('un usuario con sesión no ve el login', async ({ paginaAutenticada: page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/$/)
  })

  test('cerrar sesión regresa al login y limpia la sesión', async ({ paginaAutenticada: page }) => {
    test.skip(test.info().project.name === 'movil', 'El menú lateral se prueba en responsive.spec.js')
    await page.goto('/')
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expect(page).toHaveURL(/\/login$/)
    const guardada = await page.evaluate((clave) => localStorage.getItem(clave), claveAlmacenSesion())
    expect(guardada).toBeNull()
  })
})
