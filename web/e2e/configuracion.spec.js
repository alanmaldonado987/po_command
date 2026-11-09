import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { abrir, expect, tarjeta, test, toast } from './support/fixtures.js'

const PLAN_REAL = path.resolve(import.meta.dirname, '../../data_inicial/plan_de_trabajo.xlsx')
const filasCatalogo = (page) => page.locator('div.space-y-2 > div.rounded-xl')
const pestana = (page, nombre) => page.getByRole('tab', { name: nombre })
const usosDe = (backend, clienteId) => backend.estado.item.filter((i) => i.cliente_id === clienteId).length

async function leerDescarga(descarga) {
  return XLSX.read(fs.readFileSync(await descarga.path()))
}

test.describe('Configuración & Datos · tarjetas', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/configuracion')
    await expect(page.getByRole('heading', { level: 5, name: 'Product Owner' })).toBeVisible()
  })

  test('guarda los datos del Product Owner', async ({ paginaAutenticada: page, backend }) => {
    const tarjetaPo = tarjeta(page, 'Product Owner')
    await expect(tarjetaPo.getByLabel('Nombre')).toHaveValue('Verónica Rodríguez')
    await tarjetaPo.getByLabel('Nombre').fill('Verónica R.')
    await tarjetaPo.getByLabel(/^Correo/).fill('  nueva@ises.com.co ')
    await tarjetaPo.getByRole('button', { name: 'Guardar' }).click()
    await expect(toast(page, 'Datos del PO guardados.')).toBeVisible()
    expect(backend.estado.config).toMatchObject({ po_nombre: 'Verónica R.', po_correo: 'nueva@ises.com.co' })
  })

  test('resume el servidor de correo sin exponer credenciales', async ({ paginaAutenticada: page }) => {
    const correo = tarjeta(page, 'Servidor de correo')
    await expect(correo).toContainText('Simulación')
    await expect(correo).toContainText('smtp.office365.com:587 (starttls)')
    await expect(correo).not.toContainText('password')
  })

  test('la tarjeta de base de datos cuenta los ítems y descarga el respaldo', async ({ paginaAutenticada: page }) => {
    const base = tarjeta(page, 'Base de datos')
    await expect(base).toContainText('25 ítems del backlog')
    const [descarga] = await Promise.all([page.waitForEvent('download'), base.getByRole('button', { name: 'Descargar respaldo' }).click()])
    expect(descarga.suggestedFilename()).toMatch(/^po_command_\d{8}\.xlsx$/)
    const libro = await leerDescarga(descarga)
    expect(libro.SheetNames).toHaveLength(15)
    expect(XLSX.utils.sheet_to_json(libro.Sheets.item)).toHaveLength(25)
    expect(libro.SheetNames).toEqual(expect.arrayContaining(['item', 'persona', 'regla_alerta', 'auditoria']))
  })
})

test.describe('Configuración & Datos · catálogos', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/configuracion')
    await expect(filasCatalogo(page).nth(1)).toBeVisible()
  })

  test('lista los clientes con el número de ítems que los usan', async ({ paginaAutenticada: page, backend }) => {
    await expect(filasCatalogo(page)).toHaveCount(4)
    await expect(filasCatalogo(page).nth(2)).toContainText(`${usosDe(backend, 1)} ítems`)
    await expect(filasCatalogo(page).nth(1).getByLabel('Nombre')).toHaveValue('ACUACAR')
  })

  test('agrega un cliente nuevo', async ({ paginaAutenticada: page, backend }) => {
    await filasCatalogo(page).first().getByLabel('Nombre').fill('CLIENTE QA')
    await filasCatalogo(page).first().getByRole('button', { name: 'Agregar' }).click()
    await expect(toast(page, 'Registro agregado.')).toBeVisible()
    await expect(filasCatalogo(page)).toHaveCount(5)
    expect(backend.estado.cliente.map((c) => c.nombre)).toContain('CLIENTE QA')
  })

  test('rechaza un nombre duplicado', async ({ paginaAutenticada: page, backend }) => {
    await filasCatalogo(page).first().getByLabel('Nombre').fill('AIR-E')
    await filasCatalogo(page).first().getByRole('button', { name: 'Agregar' }).click()
    await expect(toast(page, 'Ya existe un registro con ese nombre.')).toBeVisible()
    expect(backend.estado.cliente).toHaveLength(3)
  })

  test('el botón Agregar está deshabilitado sin nombre', async ({ paginaAutenticada: page }) => {
    await expect(filasCatalogo(page).first().getByRole('button', { name: 'Agregar' })).toBeDisabled()
  })

  test('renombra un cliente y conserva sus ítems', async ({ paginaAutenticada: page, backend }) => {
    const fila = filasCatalogo(page).nth(1)
    await fila.getByLabel('Nombre').fill('ACUACAR S.A.')
    await fila.getByRole('button', { name: 'Guardar' }).click()
    await expect(toast(page, 'Cambios guardados.')).toBeVisible()
    expect(backend.estado.cliente.find((c) => c.id === 3).nombre).toBe('ACUACAR S.A.')
    expect(usosDe(backend, 3)).toBe(6)
  })

  test('eliminar muestra los ítems afectados y pide confirmación', async ({ paginaAutenticada: page, backend }) => {
    const afectados = usosDe(backend, 3)
    await filasCatalogo(page).nth(1).getByRole('button', { name: 'Eliminar ACUACAR' }).click()
    await expect(filasCatalogo(page).nth(1)).toContainText(`${afectados} ítem(s) quedarán sin este dato. ¿Eliminar?`)
    await filasCatalogo(page).nth(1).getByRole('button', { name: 'No' }).click()
    await expect(filasCatalogo(page)).toHaveCount(4)

    await filasCatalogo(page).nth(1).getByRole('button', { name: 'Eliminar ACUACAR' }).click()
    await filasCatalogo(page).nth(1).getByRole('button', { name: 'Sí' }).click()
    await expect(toast(page, 'Registro eliminado.')).toBeVisible()
    await expect(filasCatalogo(page)).toHaveCount(3)
    expect(backend.estado.item.filter((i) => i.cliente_id === null)).toHaveLength(afectados)
  })

  test('los módulos se asocian a un producto', async ({ paginaAutenticada: page }) => {
    await page.getByRole('button', { name: 'Módulos / componentes' }).click()
    await expect(filasCatalogo(page)).toHaveCount(5)
    await expect(filasCatalogo(page).nth(1).getByLabel('Producto')).toHaveValue('1')
  })

  test('las actividades no tienen estado', async ({ paginaAutenticada: page }) => {
    await page.getByRole('button', { name: 'Actividades' }).click()
    await expect(filasCatalogo(page)).toHaveCount(4)
    await expect(filasCatalogo(page).first().getByLabel('Estado')).toHaveCount(0)
  })
})

test.describe('Configuración & Datos · importación', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/configuracion')
    await pestana(page, 'Importar Plan de Trabajo').click()
  })

  test('lee el Excel real, muestra la vista previa y lo importa', async ({ paginaAutenticada: page, backend }) => {
    await page.locator('input[type=file]').setInputFiles(PLAN_REAL)
    await expect(page.getByText('274 filas leídas')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/274 nuevas · 0 ya existen y se revisarán/)).toBeVisible()
    await expect(page.getByText(/Se agregarán al equipo \(sin correo\):/)).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Fin pruebas plan.' })).toBeVisible()
    expect(backend.estado.item).toHaveLength(25)

    await page.getByRole('button', { name: 'Importar 274 filas' }).click()
    await expect(page.getByText(/Importación lista: 274 ítems nuevos, 0 actualizados/)).toBeVisible({ timeout: 20_000 })
    expect(backend.estado.item).toHaveLength(25 + 274)
    expect(backend.estado.auditoria.some((a) => a.entidad === 'importacion')).toBe(true)
    expect(new Set(backend.estado.item.map((i) => i.cliente_id)).size).toBeGreaterThanOrEqual(4)
  })

  test('volver a importar el mismo archivo no duplica ítems', async ({ paginaAutenticada: page, backend }) => {
    await page.locator('input[type=file]').setInputFiles(PLAN_REAL)
    await page.getByRole('button', { name: 'Importar 274 filas' }).click()
    await expect(page.getByText(/Importación lista: 274 ítems nuevos/)).toBeVisible({ timeout: 20_000 })
    const total = backend.estado.item.length

    await page.locator('input[type=file]').setInputFiles(PLAN_REAL)
    await expect(page.getByText(/0 nuevas · 274 ya existen/)).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Importar 274 filas' }).click()
    await expect(page.getByText(/Importación lista: 0 ítems nuevos/)).toBeVisible({ timeout: 20_000 })
    expect(backend.estado.item).toHaveLength(total)
  })

  test('un archivo sin filas del plan muestra un error', async ({ paginaAutenticada: page }) => {
    await page.locator('input[type=file]').setInputFiles({
      name: 'vacio.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('esto no es un excel'),
    })
    await expect(page.getByText(/No encontré filas del plan en ese archivo\.|No se pudo leer el archivo/)).toBeVisible()
    await expect(page.getByRole('button', { name: /^Importar \d+ filas$/ })).toHaveCount(0)
  })

  test('el servidor rechaza la importación y se informa el error', async ({ paginaAutenticada: page, backend }) => {
    await page.locator('input[type=file]').setInputFiles(PLAN_REAL)
    await expect(page.getByText('274 filas leídas')).toBeVisible({ timeout: 20_000 })
    backend.fallarConsulta('/rpc/importar_plan', { estado: 400, mensaje: 'importación rechazada' })
    await page.getByRole('button', { name: 'Importar 274 filas' }).click()
    await expect(page.getByText('importación rechazada')).toBeVisible()
  })
})

test.describe('Configuración & Datos · exportar y auditoría', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/configuracion')
  })

  test('exporta el backlog en formato Plan de Trabajo', async ({ paginaAutenticada: page }) => {
    await pestana(page, 'Exportar y respaldo').click()
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar backlog en formato Plan de Trabajo' }).click(),
    ])
    const libro = await leerDescarga(descarga)
    expect(libro.SheetNames.sort()).toEqual(['ACUACAR', 'AIR-E', 'ELECTROHUILA'])
  })

  test('exporta todas las tablas', async ({ paginaAutenticada: page }) => {
    await pestana(page, 'Exportar y respaldo').click()
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar todas las tablas (técnico)' }).click(),
    ])
    expect((await leerDescarga(descarga)).SheetNames).toHaveLength(15)
  })

  test('la auditoría refleja los cambios hechos en catálogos', async ({ paginaAutenticada: page }) => {
    await filasCatalogo(page).first().getByLabel('Nombre').fill('CLIENTE AUDITADO')
    await filasCatalogo(page).first().getByRole('button', { name: 'Agregar' }).click()
    await expect(toast(page, 'Registro agregado.')).toBeVisible()
    await pestana(page, 'Auditoría').click()
    const filaAuditoria = page.getByRole('row').filter({ hasText: 'CLIENTE AUDITADO' })
    await expect(filaAuditoria).toContainText('cliente')
    await expect(filaAuditoria).toContainText('crear')
  })

  test('las pestañas exponen roles accesibles y marcan la activa', async ({ paginaAutenticada: page }) => {
    await expect(page.getByRole('tablist')).toBeVisible()
    await expect(pestana(page, 'Catálogos')).toHaveAttribute('aria-selected', 'true')
    await pestana(page, 'Auditoría').click()
    await expect(pestana(page, 'Auditoría')).toHaveAttribute('aria-selected', 'true')
    await expect(pestana(page, 'Catálogos')).toHaveAttribute('aria-selected', 'false')
  })
})
