import { expect, test as base } from '@playwright/test'
import { claveAlmacenSesion, crearSesion, FakeBackend } from './fakeBackend.js'

export { expect }

export const test = base.extend({
  backend: async ({ context }, use) => {
    const backend = new FakeBackend()
    await backend.instalar(context)
    await use(backend)
    expect(backend.violaciones, 'ninguna petición debe salir hacia un Supabase real').toEqual([])
  },

  paginaAnonima: async ({ page, backend }, use) => {
    void backend
    await use(page)
  },

  paginaAutenticada: async ({ page, context, backend }, use) => {
    void backend
    await context.addInitScript(
      ([clave, sesion]) => {
        if (sessionStorage.getItem('e2e-sembrado')) return
        sessionStorage.setItem('e2e-sembrado', '1')
        localStorage.setItem(clave, JSON.stringify(sesion))
      },
      [claveAlmacenSesion(), crearSesion()],
    )
    await use(page)
  },
})

export const textoNormalizado = (texto) => texto.replace(/\s+/g, ' ').trim()

export async function abrir(page, ruta) {
  await page.goto(ruta)
  await expect(page.getByRole('main')).toBeVisible()
}

export const tarjeta = (page, titulo) =>
  page.locator('section', { has: page.getByRole('heading', { level: 5, name: titulo, exact: true }) })

export const kpi = (page, etiqueta) =>
  page.locator('div.relative.overflow-hidden', { has: page.getByText(etiqueta, { exact: true }) }).first()

const campoMultiple = (page, etiqueta) =>
  page.locator('div.block.min-w-0', { has: page.locator('span.field-label', { hasText: new RegExp(`^${etiqueta}$`) }) }).first()

export async function elegirOpciones(page, etiqueta, opciones) {
  const campo = campoMultiple(page, etiqueta)
  await campo.getByRole('button').first().click()
  for (const opcion of opciones) await campo.getByRole('checkbox', { name: opcion, exact: true }).check()
  await page.mouse.click(2, 2)
}

export const toast = (page, texto) => page.getByRole('alert').filter({ hasText: texto })
