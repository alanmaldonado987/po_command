import { abrir, elegirOpciones, expect, kpi, tarjeta, test } from './support/fixtures.js'

const abiertosDe = (backend, clienteId) =>
  backend.estado.item.filter((i) => i.cliente_id === clienteId && !['Terminado', 'Suspendido'].includes(i.estado))

test.describe('Cronograma', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/cronograma')
    await expect(page.getByRole('heading', { level: 5, name: /^Cronograma · / })).toBeVisible()
  })

  test('arranca con el primer cliente en orden alfabético y solo ítems abiertos', async ({ paginaAutenticada: page, backend }) => {
    await expect(page.getByRole('heading', { level: 5, name: 'Cronograma · ACUACAR' })).toBeVisible()
    await expect(kpi(page, 'Ítems en vista')).toContainText(String(abiertosDe(backend, 3).length))
  })

  test('cambiar de cliente actualiza el cronograma y los KPIs', async ({ paginaAutenticada: page, backend }) => {
    await page.getByLabel('Cliente').selectOption('AIR-E')
    await expect(page.getByRole('heading', { level: 5, name: 'Cronograma · AIR-E' })).toBeVisible()
    await expect(kpi(page, 'Ítems en vista')).toContainText(String(abiertosDe(backend, 1).length))
    await expect(kpi(page, 'En pruebas')).toContainText('2')
  })

  test('«Solo abiertos» desactivado incluye terminados y suspendidos', async ({ paginaAutenticada: page, backend }) => {
    const todos = backend.estado.item.filter((i) => i.cliente_id === 3).length
    await page.getByRole('switch', { name: 'Solo abiertos' }).click()
    await expect(kpi(page, 'Ítems en vista')).toContainText(String(todos))
  })

  test('muestra la leyenda de tramos y la marca «Hoy»', async ({ paginaAutenticada: page }) => {
    const cronograma = tarjeta(page, 'Cronograma · ACUACAR')
    await expect(cronograma.getByText('Desarrollo / customización · planificado')).toBeVisible()
    await expect(cronograma.getByText('Ajustes (pruebas) · ejecutado')).toBeVisible()
    await expect(cronograma.getByText('Hoy', { exact: true })).toBeVisible()
  })

  test('lista los ítems sin fechas en un desplegable', async ({ paginaAutenticada: page }) => {
    await expect(kpi(page, 'Sin fechas')).toContainText('1')
    await page.getByText('1 ítem(s) sin fechas').click()
    await expect(page.getByRole('cell', { name: 'Tablero de metas' })).toBeVisible()
  })

  test('filtra por actividad y avisa cuando ningún ítem tiene fechas', async ({ paginaAutenticada: page }) => {
    await elegirOpciones(page, 'Actividad', ['SCR'])
    await expect(page.getByText('Ningún ítem de este filtro tiene fechas.')).toBeVisible()
  })

  test('filtra por responsable', async ({ paginaAutenticada: page }) => {
    await page.getByLabel('Cliente').selectOption('AIR-E')
    await elegirOpciones(page, 'Responsable', ['Luis Kendor Narváez'])
    await expect(kpi(page, 'Ítems en vista')).toContainText('2')
  })

  test('sin ítems con cliente muestra el estado vacío', async ({ paginaAutenticada: page, backend }) => {
    backend.estado.item = []
    await page.reload()
    await expect(page.getByText('Aún no hay ítems con cliente.')).toBeVisible()
  })
})
