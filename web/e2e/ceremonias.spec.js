import { abrir, expect, tarjeta, test, toast } from './support/fixtures.js'

async function verDetalle(page, titulo) {
  await page.locator('div.space-y-1\\.5', { hasText: titulo }).getByRole('button', { name: 'Ver detalle' }).click()
  await expect(page.getByRole('heading', { level: 5, name: titulo })).toBeVisible()
}

test.describe('Demos & Ceremonias · agenda', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/ceremonias')
    await expect(page.getByText('Demo AIR-E octubre')).toBeVisible()
  })

  test('lista las ceremonias próximas y oculta las pasadas', async ({ paginaAutenticada: page }) => {
    await expect(page.getByText('Seguimiento ELECTROHUILA')).toBeVisible()
    await expect(page.getByText('Retro del sprint')).toBeVisible()
    await expect(page.getByText('Planning ACUACAR pasado')).toHaveCount(0)
    await expect(page.getByText('Elige una ceremonia para ver invitados, enviar la invitación o editarla.')).toBeVisible()
  })

  test('«Ver pasadas» incluye las ceremonias anteriores', async ({ paginaAutenticada: page }) => {
    await page.getByRole('switch', { name: 'Ver pasadas' }).click()
    await expect(page.getByText('Planning ACUACAR pasado')).toBeVisible()
  })

  test('el detalle muestra invitados y los ítems listos para la demo', async ({ paginaAutenticada: page }) => {
    await verDetalle(page, 'Demo AIR-E octubre')
    const detalle = tarjeta(page, 'Demo AIR-E octubre')
    await expect(detalle).toContainText('Recibirán la invitación (6):')
    await expect(detalle).toContainText('Verónica Rodríguez (en lugar de Marcela Ríos, sin correo)')
    await expect(detalle).toContainText('Ítems de AIR-E listos para mostrar')
    await expect(detalle).toContainText('Tablero de supervisión')
    await expect(detalle).toContainText('Asignación masiva')
  })

  test('reenvía una invitación ya enviada', async ({ paginaAutenticada: page, backend }) => {
    await verDetalle(page, 'Demo AIR-E octubre')
    await page.getByRole('button', { name: 'Reenviar invitación' }).click()
    await expect(toast(page, 'Invitación enviada a 6 persona(s).')).toBeVisible()
    expect(backend.estado.alerta_programada.some((a) => a.regla_codigo === 'CEREMONIA' && a.asunto.includes('[Invitación] Demo AIR-E octubre'))).toBe(true)
  })

  test('envía la primera invitación y cambia el chip de la agenda', async ({ paginaAutenticada: page, backend }) => {
    await verDetalle(page, 'Seguimiento ELECTROHUILA')
    await page.getByRole('button', { name: 'Enviar invitación' }).click()
    await expect(toast(page, /Invitación enviada a \d+ persona\(s\)\./)).toBeVisible()
    expect(backend.estado.ceremonia.find((c) => c.id === 2).invitacion_enviada).toBe(true)
    await expect(page.getByRole('button', { name: 'Reenviar invitación' })).toBeVisible()
  })

  test('agenda una ceremonia nueva', async ({ paginaAutenticada: page, backend }) => {
    await page.getByRole('button', { name: 'Agendar' }).click()
    await expect(page.getByRole('heading', { level: 5, name: 'Nueva ceremonia' })).toBeVisible()
    await page.getByLabel('Título *').fill('Refinamiento QA')
    await page.getByLabel('Tipo').selectOption('Refinamiento')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(toast(page, 'Ceremonia guardada. Los recordatorios se programan automáticamente.')).toBeVisible()
    await expect(page.getByText('Refinamiento QA').first()).toBeVisible()
    expect(backend.estado.ceremonia.at(-1)).toMatchObject({ titulo: 'Refinamiento QA', tipo: 'Refinamiento', duracion_min: 60, lugar: 'Teams' })
  })

  test('la duración por defecto es válida para el navegador (regresión H-01)', async ({ paginaAutenticada: page }) => {
    await page.getByRole('button', { name: 'Agendar' }).click()
    await expect(page.getByLabel('Duración (min)')).toHaveJSProperty('validity.valid', true)
  })

  test('el formulario se puede guardar con los valores por defecto', async ({ paginaAutenticada: page, backend }) => {
    await page.getByRole('button', { name: 'Agendar' }).click()
    await page.getByLabel('Título *').fill('Con valores por defecto')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(toast(page, 'Ceremonia guardada.')).toBeVisible({ timeout: 3000 })
    expect(backend.estado.ceremonia).toHaveLength(5)
  })

  test('exige un título', async ({ paginaAutenticada: page, backend }) => {
    await page.getByRole('button', { name: 'Agendar' }).click()
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByText('El título es obligatorio.')).toBeVisible()
    expect(backend.estado.ceremonia).toHaveLength(4)
  })

  test('edita una ceremonia existente', async ({ paginaAutenticada: page, backend }) => {
    await verDetalle(page, 'Retro del sprint')
    await page.getByLabel('Título *').fill('Retro renombrada')
    await page.getByLabel('Lugar o enlace').fill('Sala 5')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByRole('heading', { level: 5, name: 'Retro renombrada' })).toBeVisible()
    expect(backend.estado.ceremonia.find((c) => c.id === 3)).toMatchObject({ titulo: 'Retro renombrada', lugar: 'Sala 5' })
  })

  test('elimina una ceremonia y cancela sus recordatorios', async ({ paginaAutenticada: page, backend }) => {
    await verDetalle(page, 'Demo AIR-E octubre')
    await page.getByRole('button', { name: 'Eliminar ceremonia' }).click()
    await expect(toast(page, 'Ceremonia eliminada y sus recordatorios cancelados.')).toBeVisible()
    await expect(page.getByText('Demo AIR-E octubre')).toHaveCount(0)
    expect(backend.estado.alerta_programada.find((a) => a.regla_codigo === 'CEREMONIA' && a.entidad_id === 1).estado).toBe('Cancelada')
  })
})

test.describe('Demos & Ceremonias · acuerdos', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/ceremonias')
    await expect(page.getByRole('heading', { level: 5, name: 'Acuerdos y compromisos' })).toBeVisible()
  })

  test('muestra los acuerdos existentes', async ({ paginaAutenticada: page }) => {
    const acuerdos = page.getByLabel('Acuerdo', { exact: true })
    await expect(acuerdos).toHaveCount(3)
    await expect(acuerdos.first()).toHaveValue('Actualizar manual de usuario')
    await expect(acuerdos.last()).toHaveValue('Definir API con el proveedor')
  })

  test('agrega un acuerdo y lo guarda', async ({ paginaAutenticada: page, backend }) => {
    await page.getByRole('button', { name: 'Agregar acuerdo' }).click()
    await page.getByLabel('Acuerdo', { exact: true }).last().fill('Revisar pruebas de regresión')
    await page.getByLabel('Responsable').last().selectOption({ label: 'Marcela Ríos' })
    await page.getByRole('button', { name: 'Guardar acuerdos' }).click()
    await expect(toast(page, 'Acuerdos guardados.')).toBeVisible()
    expect(backend.estado.acuerdo).toHaveLength(4)
    expect(backend.estado.acuerdo.at(-1)).toMatchObject({ descripcion: 'Revisar pruebas de regresión', responsable_id: 3, estado: 'Pendiente' })
  })

  test('edita el estado de un acuerdo', async ({ paginaAutenticada: page, backend }) => {
    await page.getByLabel('Estado').nth(1).selectOption('Cumplido')
    await page.getByRole('button', { name: 'Guardar acuerdos' }).click()
    await expect(toast(page, 'Acuerdos guardados.')).toBeVisible()
    expect(backend.estado.acuerdo.find((a) => a.id === 1).estado).toBe('Cumplido')
  })

  test('quita un acuerdo y se elimina al guardar', async ({ paginaAutenticada: page, backend }) => {
    await page.getByRole('button', { name: 'Quitar acuerdo' }).first().click()
    await expect(page.getByLabel('Acuerdo', { exact: true })).toHaveCount(2)
    expect(backend.estado.acuerdo).toHaveLength(3)
    await page.getByRole('button', { name: 'Guardar acuerdos' }).click()
    await expect(toast(page, 'Acuerdos guardados.')).toBeVisible()
    expect(backend.estado.acuerdo.map((a) => a.id)).toEqual([1, 2])
  })

  test('ignora las filas sin descripción', async ({ paginaAutenticada: page, backend }) => {
    await page.getByRole('button', { name: 'Agregar acuerdo' }).click()
    await page.getByRole('button', { name: 'Guardar acuerdos' }).click()
    await expect(toast(page, 'Acuerdos guardados.')).toBeVisible()
    expect(backend.estado.acuerdo).toHaveLength(3)
  })
})
