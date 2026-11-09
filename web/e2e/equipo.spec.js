import { abrir, elegirOpciones, expect, test, toast } from './support/fixtures.js'

const ficha = (page, nombre) => page.locator('article', { hasText: nombre })
const itemsAbiertosDe = (backend, id) =>
  backend.estado.item.filter((i) => i.responsable_id === id && !['Terminado', 'Suspendido'].includes(i.estado)).length

test.describe('Equipo & Stakeholders', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/equipo')
    await expect(ficha(page, 'Dairo Pérez')).toBeVisible()
  })

  test('muestra el equipo de desarrollo con su carga de ítems abiertos', async ({ paginaAutenticada: page, backend }) => {
    await expect(page.locator('article')).toHaveCount(3)
    await expect(ficha(page, 'Dairo Pérez')).toContainText(`Ítems abiertos${itemsAbiertosDe(backend, 2)}`.slice(0, 14))
    await expect(ficha(page, 'Dairo Pérez')).toContainText('dairo.perez@ises.com.co')
    await expect(ficha(page, 'Dairo Pérez')).toContainText('Developer')
  })

  test('avisa de las personas sin correo válido', async ({ paginaAutenticada: page }) => {
    await expect(page.getByText('1 persona(s) sin correo válido: sus alertas se redirigen al PO.')).toBeVisible()
    await expect(ficha(page, 'Marcela Ríos')).toContainText('Falta correo válido')
  })

  test('cambia a stakeholders y muestra su frecuencia de reporte y clientes', async ({ paginaAutenticada: page }) => {
    await page.getByRole('button', { name: 'Stakeholders' }).click()
    await expect(page.locator('article')).toHaveCount(3)
    await expect(ficha(page, 'Carlos Gómez')).toContainText('AIR-E')
    await expect(ficha(page, 'Carlos Gómez')).toContainText('Reporte: Resumen semanal')
    await expect(ficha(page, 'Carlos Gómez')).toContainText('Escalamientos')
  })

  test('busca por nombre, rol o cliente', async ({ paginaAutenticada: page }) => {
    await page.getByLabel('Buscar').fill('qa')
    await expect(page.locator('article')).toHaveCount(1)
    await expect(ficha(page, 'Marcela Ríos')).toBeVisible()
    await page.getByLabel('Buscar').fill('zzz')
    await expect(page.getByText('No hay personas que coincidan.')).toBeVisible()
    await page.getByRole('button', { name: 'Stakeholders' }).click()
    await page.getByLabel('Buscar').fill('electrohuila')
    await expect(page.locator('article')).toHaveCount(1)
    await expect(ficha(page, 'Julio Mora')).toBeVisible()
  })

  test('agrega una persona nueva al directorio', async ({ paginaAutenticada: page, backend }) => {
    await page.getByRole('button', { name: 'Agregar persona' }).click()
    await expect(page.getByRole('heading', { level: 5, name: 'Nueva persona' })).toBeVisible()
    await page.getByLabel('Nombre completo *').fill('Sofía Vargas')
    await page.getByLabel('Correo').fill('sofia.vargas@ises.com.co')
    await page.getByLabel(/^Rol/).fill('Analista')
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(toast(page, 'Sofía Vargas agregado al directorio.')).toBeVisible()
    await expect(ficha(page, 'Sofía Vargas')).toContainText('sofia.vargas@ises.com.co')
    expect(backend.estado.persona.at(-1)).toMatchObject({ nombre: 'Sofía Vargas', tipo: 'equipo', recibe: ['Bloqueantes', 'Vencimientos', 'Ceremonias'] })
  })

  test('exige el nombre', async ({ paginaAutenticada: page, backend }) => {
    await page.getByRole('button', { name: 'Agregar persona' }).click()
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(page.getByText('El nombre es obligatorio.')).toBeVisible()
    expect(backend.estado.persona).toHaveLength(6)
  })

  test('un correo inválido se guarda con una advertencia', async ({ paginaAutenticada: page, backend }) => {
    await page.getByRole('button', { name: 'Agregar persona' }).click()
    await page.getByLabel('Nombre completo *').fill('Persona Rara')
    await page.getByLabel('Correo').fill('correo-sin-arroba')
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(toast(page, 'Ojo: el correo no parece válido; sus alertas irán al PO.')).toBeVisible()
    await expect(ficha(page, 'Persona Rara')).toContainText('Falta correo válido')
    expect(backend.estado.persona.at(-1).correo).toBe('correo-sin-arroba')
  })

  test('edita una persona existente', async ({ paginaAutenticada: page, backend }) => {
    await ficha(page, 'Dairo Pérez').getByRole('button', { name: 'Editar' }).click()
    await expect(page.getByRole('heading', { level: 5, name: 'Editar a Dairo Pérez' })).toBeVisible()
    await page.getByLabel(/^Rol/).fill('Senior Developer')
    await page.getByRole('button', { name: 'Escalamientos' }).click()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(toast(page, 'Dairo Pérez actualizado.')).toBeVisible()
    expect(backend.estado.persona.find((p) => p.id === 2)).toMatchObject({ rol: 'Senior Developer' })
    expect(backend.estado.persona.find((p) => p.id === 2).recibe).toContain('Escalamientos')
    await expect(ficha(page, 'Dairo Pérez')).toContainText('Senior Developer')
  })

  test('asigna clientes a un stakeholder', async ({ paginaAutenticada: page, backend }) => {
    await page.getByRole('button', { name: 'Stakeholders' }).click()
    await ficha(page, 'Carlos Gómez').getByRole('button', { name: 'Editar' }).click()
    await elegirOpciones(page, 'Clientes', ['ACUACAR'])
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(toast(page, 'Carlos Gómez actualizado.')).toBeVisible()
    expect(backend.estado.persona_cliente.filter((pc) => pc.persona_id === 4).map((pc) => pc.cliente_id).sort()).toEqual([1, 3])
    await expect(ficha(page, 'Carlos Gómez')).toContainText('ACUACAR, AIR-E')
  })

  test('desactivar a una persona muestra el chip «Inactivo»', async ({ paginaAutenticada: page, backend }) => {
    await ficha(page, 'Luis Kendor Narváez').getByRole('button', { name: 'Editar' }).click()
    await page.getByRole('switch', { name: 'Activo' }).click()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(ficha(page, 'Luis Kendor Narváez')).toContainText('Inactivo')
    expect(backend.estado.persona.find((p) => p.id === 1).activo).toBe(false)
  })

  test('eliminar pide confirmación y deja los ítems sin responsable', async ({ paginaAutenticada: page, backend }) => {
    const abiertos = itemsAbiertosDe(backend, 1)
    await ficha(page, 'Luis Kendor Narváez').getByRole('button', { name: 'Editar' }).click()
    await page.getByRole('button', { name: 'Eliminar persona' }).click()
    await expect(page.getByText(`¿Eliminar a Luis Kendor Narváez? Dejará de recibir alertas y sus ${abiertos} ítem(s) abiertos quedarán sin responsable.`)).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(ficha(page, 'Luis Kendor Narváez')).toBeVisible()

    await page.getByRole('button', { name: 'Eliminar persona' }).click()
    await page.getByRole('button', { name: 'Sí, eliminar' }).click()
    await expect(toast(page, 'Luis Kendor Narváez eliminado del directorio.')).toBeVisible()
    await expect(ficha(page, 'Luis Kendor Narváez')).toHaveCount(0)
    expect(backend.estado.item.filter((i) => i.responsable_id === 1)).toHaveLength(0)
  })

  test('el botón Cerrar descarta el editor', async ({ paginaAutenticada: page }) => {
    await page.getByRole('button', { name: 'Agregar persona' }).click()
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
    await expect(page.getByRole('heading', { level: 5, name: 'Nueva persona' })).toHaveCount(0)
  })
})
