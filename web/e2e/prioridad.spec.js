import { abrir, elegirOpciones, expect, test, toast } from './support/fixtures.js'

const filasDatos = (page) => page.getByRole('row').filter({ has: page.getByRole('cell') })
const fila = (page, codigo) => page.getByRole('row').filter({ hasText: codigo })
const itemsActivos = (backend) => backend.estado.item.filter((i) => !i.eliminado_en)
const SIN_CHIP = /Urgente|Alta|Normal|Baja/

async function abrirItem(page, codigo) {
  await fila(page, codigo).click()
  await expect(page.getByRole('heading', { level: 5, name: `Editar ${codigo}` })).toBeVisible()
}

async function guardarPrioridad(page, codigo, prioridad) {
  await abrirItem(page, codigo)
  await page.getByRole('combobox', { name: 'Prioridad' }).selectOption(prioridad)
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(toast(page, `${codigo} guardado en la base de datos.`)).toBeVisible()
  await fila(page, codigo).click()
}

test.describe('Backlog · prioridad', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/backlog')
    await expect(filasDatos(page).first()).toBeVisible()
  })

  test('crear un ítem con prioridad la guarda y la muestra en la tabla', async ({ paginaAutenticada: page, backend }) => {
    await page.getByRole('button', { name: 'Nuevo ítem' }).click()
    await page.getByLabel('Cliente *').fill('AIR-E')
    await page.getByLabel('Actividad *').fill('SCR')
    await page.getByLabel('Módulo / componente *').fill('Órdenes')
    await page.getByLabel('Menú / funcionalidad *').fill('Prueba de prioridad')
    await page.getByLabel('Alcance *').selectOption('Web')
    await page.getByRole('combobox', { name: 'Prioridad' }).selectOption('Urgente')
    await page.getByRole('button', { name: 'Crear ítem' }).click()

    await expect(toast(page, 'BL-026 guardado en la base de datos.')).toBeVisible()
    await expect(fila(page, 'BL-026')).toContainText('Urgente')
    expect(itemsActivos(backend).find((i) => i.codigo === 'BL-026').prioridad).toBe('Urgente')
  })

  test('un ítem sin prioridad no muestra chip y el editor ofrece «Sin prioridad»', async ({ paginaAutenticada: page }) => {
    await expect(fila(page, 'BL-009')).not.toContainText(SIN_CHIP)
    await abrirItem(page, 'BL-009')
    const selector = page.getByRole('combobox', { name: 'Prioridad' })
    await expect(selector).toHaveValue('')
    await expect(selector.locator('option')).toHaveText(['Sin prioridad', 'Urgente', 'Alta', 'Normal', 'Baja'])
  })

  test('editar la prioridad la cambia y quitarla la deja vacía', async ({ paginaAutenticada: page, backend }) => {
    await guardarPrioridad(page, 'BL-009', 'Alta')
    await expect(fila(page, 'BL-009')).toContainText('Alta')
    expect(itemsActivos(backend).find((i) => i.codigo === 'BL-009').prioridad).toBe('Alta')

    await guardarPrioridad(page, 'BL-009', 'Baja')
    await expect(fila(page, 'BL-009')).toContainText('Baja')

    await guardarPrioridad(page, 'BL-009', { label: 'Sin prioridad' })
    await expect(fila(page, 'BL-009')).not.toContainText(SIN_CHIP)
    expect(itemsActivos(backend).find((i) => i.codigo === 'BL-009').prioridad).toBeNull()
  })

  test('filtra por prioridad, incluida «Sin prioridad»', async ({ paginaAutenticada: page, backend }) => {
    await guardarPrioridad(page, 'BL-009', 'Urgente')
    await guardarPrioridad(page, 'BL-010', 'Normal')
    await page.getByText('Más filtros').click()

    await elegirOpciones(page, 'Prioridad', ['Urgente'])
    await expect(filasDatos(page)).toHaveCount(1)
    await expect(fila(page, 'BL-009')).toBeVisible()

    await elegirOpciones(page, 'Prioridad', ['Normal'])
    await expect(filasDatos(page)).toHaveCount(2)

    await elegirOpciones(page, 'Prioridad', ['Urgente', 'Normal'])
    await elegirOpciones(page, 'Prioridad', ['Sin prioridad'])
    await expect(filasDatos(page)).toHaveCount(itemsActivos(backend).length - 2)
  })

  test('ordenar por prioridad pone primero Urgente y al final los sin prioridad', async ({ paginaAutenticada: page }) => {
    await guardarPrioridad(page, 'BL-020', 'Baja')
    await guardarPrioridad(page, 'BL-009', 'Urgente')
    await guardarPrioridad(page, 'BL-010', 'Alta')
    await page.getByText('Más filtros').click()
    await page.getByLabel('Ordenar por').selectOption('Prioridad')

    const filas = filasDatos(page)
    await expect(filas.nth(0)).toContainText('BL-009')
    await expect(filas.nth(1)).toContainText('BL-010')
    await expect(filas.nth(2)).toContainText('BL-020')
    await expect(filas.last()).not.toContainText(SIN_CHIP)

    await page.getByLabel('Ordenar por').selectOption('Plan de trabajo')
    await expect(filas.first()).not.toContainText('BL-009')
  })
})

test.describe('Backlog · prioridad · accesibilidad', () => {
  test('el selector tiene nombre accesible y el chip comunica la prioridad con texto', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/backlog')
    await expect(filasDatos(page).first()).toBeVisible()
    await abrirItem(page, 'BL-009')
    await expect(page.getByRole('combobox', { name: 'Prioridad' })).toBeVisible()
    await page.getByRole('combobox', { name: 'Prioridad' }).selectOption('Urgente')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(toast(page, 'BL-009 guardado en la base de datos.')).toBeVisible()
    const celda = fila(page, 'BL-009').getByRole('cell').filter({ hasText: 'Urgente' })
    await expect(celda).toHaveText(/Urgente/)
    await expect(celda.locator('[aria-hidden="true"]').first()).toHaveText('flag')
  })

  test('el selector de prioridad se maneja con el teclado', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/backlog')
    await abrirItem(page, 'BL-009')
    const selector = page.getByRole('combobox', { name: 'Prioridad' })
    await selector.focus()
    await expect(selector).toBeFocused()
    await selector.selectOption('Normal')
    await expect(selector).toHaveValue('Normal')
  })
})
