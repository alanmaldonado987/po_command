import { abrir, expect, tarjeta, test } from './support/fixtures.js'

const EQUIPO = { id: 't1', nombre: 'Ises' }

const envio = (id, itemId, estado, extra = {}) => ({
  id,
  item_id: itemId,
  accion: 'update',
  estado,
  intentos: estado === 'Pendiente' ? 0 : 1,
  error: null,
  creado_en: `2026-11-06T15:${String(id).padStart(2, '0')}:00Z`,
  procesado_en: estado === 'Pendiente' ? null : `2026-11-06T15:${String(id).padStart(2, '0')}:30Z`,
  ...extra,
})

function sembrar(backend, filas) {
  Object.assign(backend.estado.clickup, { token: 'pk_guardado', equipo: EQUIPO, habilitado: true })
  backend.estado.clickup_cola.push(...filas)
}

async function abrirClickUp(page) {
  await abrir(page, '/configuracion')
  await page.getByRole('tab', { name: 'ClickUp' }).click()
  await expect(page.getByRole('heading', { level: 5, name: 'Cola de envíos' })).toBeVisible()
}

const cola = (page) => tarjeta(page, 'Cola de envíos').last()
const filasDe = (page) => cola(page).getByRole('article')
const pestana = (page, nombre) => cola(page).getByRole('button', { name: nombre, exact: true })

const MEZCLA = [
  envio(1, 1, 'Enviada', { accion: 'create' }),
  envio(2, 9, 'Pendiente'),
  envio(3, 24, 'Fallida', { accion: 'mover', error: 'Sin destino configurado para Desarrollo / AIR-E', intentos: 3 }),
  envio(4, 1, 'Pendiente', { accion: 'archive' }),
  envio(5, 9, 'Fallida', { error: 'ClickUp 404: Task not found', intentos: 2 }),
]

test.describe('ClickUp · cola de envíos', () => {
  test('sin envíos muestra el estado vacío', async ({ paginaAutenticada: page, backend }) => {
    sembrar(backend, [])
    await abrirClickUp(page)
    await expect(cola(page).getByText('Aún no se ha enviado nada a ClickUp.')).toBeVisible()
    await expect(filasDe(page)).toHaveCount(0)
  })

  test('el contador «Pendientes» abre la cola filtrada a los pendientes', async ({ paginaAutenticada: page, backend }) => {
    sembrar(backend, MEZCLA)
    await abrirClickUp(page)
    await page.getByRole('button', { name: 'Pendientes: 2. Ver detalle' }).click()
    await expect(pestana(page, 'Pendientes · 2')).toHaveAttribute('aria-pressed', 'true')
    await expect(filasDe(page)).toHaveCount(2)
    await expect(cola(page)).toContainText('BL-009 · Actualizar')
    await expect(cola(page)).toContainText('BL-001 · Archivar')
    await expect(cola(page)).not.toContainText('Fallida')
  })

  test('el contador «Con error» abre la cola filtrada a los fallidos con el error completo', async ({ paginaAutenticada: page, backend }) => {
    sembrar(backend, MEZCLA)
    await abrirClickUp(page)
    await page.getByRole('button', { name: 'Con error: 2. Ver detalle' }).click()
    await expect(pestana(page, 'Con error · 2')).toHaveAttribute('aria-pressed', 'true')
    await expect(filasDe(page)).toHaveCount(2)
    await expect(cola(page).getByText('Sin destino configurado para Desarrollo / AIR-E')).toBeVisible()
    await expect(cola(page).getByText('ClickUp 404: Task not found')).toBeVisible()
    await expect(cola(page)).toContainText('Intentos: 3')
  })

  test('cada error trae una explicación en español cuando se reconoce', async ({ paginaAutenticada: page, backend }) => {
    sembrar(backend, [...MEZCLA, envio(6, 1, 'Fallida', { error: 'fallo que nadie reconoce' })])
    await abrirClickUp(page)
    await pestana(page, 'Con error · 3').click()
    await expect(cola(page).getByText(/Configura el destino de su tablero y cliente/)).toBeVisible()
    await expect(cola(page).getByText(/ClickUp no encontró la tarea o la lista/)).toBeVisible()
    const sinExplicar = filasDe(page).filter({ hasText: 'fallo que nadie reconoce' })
    await expect(sinExplicar).toHaveCount(1)
    await expect(sinExplicar).not.toContainText('Qué hacer')
  })

  test('en «Todos» salen primero los fallidos, luego los pendientes y al final los enviados', async ({ paginaAutenticada: page, backend }) => {
    sembrar(backend, MEZCLA)
    await abrirClickUp(page)
    await expect(filasDe(page)).toHaveCount(5)
    const estados = (await filasDe(page).allTextContents()).map((texto) => ['Fallida', 'Pendiente', 'Enviada'].find((estado) => texto.includes(estado)))
    expect(estados).toEqual(['Fallida', 'Fallida', 'Pendiente', 'Pendiente', 'Enviada'])
  })

  test('«Enviados» muestra solo lo enviado y «Con error» sin fallos lo dice', async ({ paginaAutenticada: page, backend }) => {
    sembrar(backend, [envio(1, 1, 'Enviada', { accion: 'create' }), envio(2, 9, 'Pendiente')])
    await abrirClickUp(page)
    await pestana(page, 'Enviados').click()
    await expect(filasDe(page)).toHaveCount(1)
    await expect(cola(page)).toContainText('BL-001 · Crear')
    await pestana(page, 'Con error · 0').click()
    await expect(cola(page).getByText('No hay envíos con error.')).toBeVisible()
  })

  test('un error muy largo se resume y se despliega completo', async ({ paginaAutenticada: page, backend }) => {
    const largo = `ClickUp 400: ${'campo inválido '.repeat(40)}FIN`
    sembrar(backend, [envio(1, 9, 'Fallida', { error: largo })])
    await abrirClickUp(page)
    const resumen = cola(page).getByText('Ver error completo')
    await expect(resumen).toBeVisible()
    await resumen.click()
    await expect(cola(page).locator('details p')).toContainText('FIN')
  })

  test('«Ver más» amplía la lista de 20 en 20', async ({ paginaAutenticada: page, backend }) => {
    sembrar(backend, Array.from({ length: 25 }, (_, i) => envio(i + 1, 9, 'Enviada')))
    await abrirClickUp(page)
    await expect(filasDe(page)).toHaveCount(20)
    await cola(page).getByRole('button', { name: 'Ver más' }).click()
    await expect(filasDe(page)).toHaveCount(25)
    await expect(cola(page).getByRole('button', { name: 'Ver más' })).toHaveCount(0)
  })

  test('los contadores y las pestañas se manejan con el teclado', async ({ paginaAutenticada: page, backend }) => {
    sembrar(backend, MEZCLA)
    await abrirClickUp(page)
    const contador = page.getByRole('button', { name: 'Con error: 2. Ver detalle' })
    await contador.focus()
    await expect(contador).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(pestana(page, 'Con error · 2')).toHaveAttribute('aria-pressed', 'true')
    await pestana(page, 'Todos').focus()
    await page.keyboard.press('Space')
    await expect(pestana(page, 'Todos')).toHaveAttribute('aria-pressed', 'true')
    await expect(filasDe(page)).toHaveCount(5)
  })

  test('la cola se actualiza tras sincronizar y deja de contar los pendientes', async ({ paginaAutenticada: page, backend }) => {
    sembrar(backend, [envio(1, 9, 'Pendiente', { accion: 'update' })])
    Object.assign(backend.estado.clickup, { webhook_registrado: false })
    backend.estado.clickup_destino.push({ id: 1, tablero_id: null, cliente_id: null, lista_id: 'l9', lista_nombre: 'Innovación y Desarrollo OTC / Backlog Dev' })
    await abrirClickUp(page)
    await page.getByRole('button', { name: 'Pendientes: 1. Ver detalle' }).click()
    await expect(filasDe(page)).toHaveCount(1)
    await page.getByRole('button', { name: 'Sincronizar ahora' }).click()
    await expect(cola(page).getByText('No hay envíos pendientes.')).toBeVisible()
    await pestana(page, 'Enviados').click()
    await expect(cola(page)).toContainText('BL-009 · Actualizar')
  })
})
