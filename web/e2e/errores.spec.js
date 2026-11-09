import { expect, test } from './support/fixtures.js'

const CASOS = [
  ['/backlog', '/rest/v1/v_item'],
  ['/cronograma', '/rest/v1/v_item'],
  ['/analitica', '/rest/v1/v_item'],
  ['/equipo', '/rest/v1/v_persona'],
  ['/ceremonias', '/rest/v1/v_ceremonia'],
  ['/alertas', '/functions/v1/correo'],
  ['/asistente', '/rest/v1/v_item'],
]

test.describe('Errores de red y estados de carga', () => {
  for (const [ruta, endpoint] of CASOS) {
    test(`${ruta} muestra el estado de error cuando ${endpoint} responde 500`, async ({ paginaAutenticada: page, backend }) => {
      backend.fallarConsulta(endpoint, { mensaje: 'caída del servicio' })
      await page.goto(ruta)
      await expect(page.getByText('No se pudieron cargar los datos:').first()).toBeVisible({ timeout: 15_000 })
    })
  }

  test('la auditoría muestra un error propio sin romper la página', async ({ paginaAutenticada: page, backend }) => {
    backend.fallarConsulta('/rest/v1/auditoria', { mensaje: 'sin permisos' })
    await page.goto('/configuracion')
    await page.getByRole('tab', { name: 'Auditoría' }).click()
    await expect(page.getByText('No se pudieron cargar los datos: sin permisos')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Base de datos y motor de alertas' })).toBeVisible()
  })

  test('sin conexión, abrir una página aún no descargada no deja la pantalla en blanco (H-05)', async ({ paginaAutenticada: page, context }) => {
    await page.goto('/')
    await expect(page.getByText('Bloqueantes activos')).toBeVisible()
    await context.setOffline(true)
    await page.getByRole('link', { name: 'Demos & Ceremonias' }).click()
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 3000 })
    await context.setOffline(false)
  })

  test('sin conexión, una página ya visitada sigue mostrando sus datos en caché', async ({ paginaAutenticada: page, context }) => {
    await page.goto('/backlog')
    await expect(page.getByRole('row').filter({ hasText: 'BL-001' })).toBeVisible()
    await page.locator('aside').getByRole('link', { name: 'Centro de Mando' }).click()
    await expect(page.getByText('Bloqueantes activos')).toBeVisible()
    await context.setOffline(true)
    await page.locator('aside').getByRole('link', { name: 'Backlog · Plan de Trabajo' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Ítems del backlog' })).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: 'BL-001' })).toBeVisible()
    await context.setOffline(false)
  })

  test('el indicador de carga aparece mientras llegan los datos', async ({ paginaAutenticada: page, backend }) => {
    backend.retardoMs = 900
    await page.goto('/backlog')
    await expect(page.getByText('Cargando…').first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Ítems del backlog' })).toBeVisible()
  })

  test('un fallo al cambiar una regla no deja la interfaz inconsistente', async ({ paginaAutenticada: page, backend }) => {
    await page.goto('/alertas')
    await expect(page.getByRole('heading', { level: 5, name: 'Cola de envíos' })).toBeVisible()
    backend.fallarConsulta('/rest/v1/regla_alerta', { estado: 500, mensaje: 'no se pudo guardar' })
    const articulo = page.locator('article', { has: page.getByRole('heading', { level: 5, name: 'Nuevo bloqueante' }) })
    await articulo.getByRole('switch', { name: 'Activa' }).click()
    await expect(page.getByRole('heading', { level: 5, name: 'Cola de envíos' })).toBeVisible()
    expect(backend.estado.regla_alerta.find((r) => r.codigo === 'BLOQUEO_NUEVO').activa).toBe(true)
  })

  test('expirar la sesión (401) no se queda con datos obsoletos', async ({ paginaAutenticada: page, backend }) => {
    backend.fallarConsulta('/rest/v1/v_item', { estado: 401, mensaje: 'JWT expired' })
    await page.goto('/backlog')
    await expect(page.getByText('No se pudieron cargar los datos: JWT expired')).toBeVisible({ timeout: 15_000 })
  })
})
