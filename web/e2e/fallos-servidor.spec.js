import { abrir, expect, test } from './support/fixtures.js'

const MENSAJE = 'fallo simulado del servidor'

const fila = (page, texto) => page.getByRole('row').filter({ hasText: texto })
const ficha = (page, nombre) => page.locator('article', { hasText: nombre })
const regla = (page, nombre) => page.locator('article', { has: page.getByRole('heading', { level: 5, name: nombre }) })

const CASOS = [
  {
    nombre: 'escalar un bloqueo desde el Centro de Mando',
    ruta: '/', endpoint: '/functions/v1/alertas', esperarListo: (page) => expect(page.getByText('Bloqueantes activos')).toBeVisible(),
    accion: (page) => page.getByRole('button', { name: 'Escalar' }).first().click(),
  },
  {
    nombre: 'enviar la invitación de una ceremonia',
    ruta: '/ceremonias', endpoint: '/functions/v1/alertas', esperarListo: (page) => expect(page.getByText('Demo AIR-E octubre')).toBeVisible(),
    accion: async (page) => {
      await page.locator('div.space-y-1\\.5', { hasText: 'Seguimiento ELECTROHUILA' }).getByRole('button', { name: 'Ver detalle' }).click()
      await page.getByRole('button', { name: 'Enviar invitación' }).click()
    },
  },
  {
    nombre: 'eliminar una ceremonia',
    ruta: '/ceremonias', endpoint: '/rpc/eliminar_ceremonia', esperarListo: (page) => expect(page.getByText('Demo AIR-E octubre')).toBeVisible(),
    accion: async (page) => {
      await page.locator('div.space-y-1\\.5', { hasText: 'Retro del sprint' }).getByRole('button', { name: 'Ver detalle' }).click()
      await page.getByRole('button', { name: 'Eliminar ceremonia' }).click()
    },
  },
  {
    nombre: 'guardar los acuerdos',
    ruta: '/ceremonias', endpoint: '/rest/v1/acuerdo', esperarListo: (page) => expect(page.getByLabel('Acuerdo', { exact: true }).first()).toBeVisible(),
    accion: async (page) => {
      await page.getByLabel('Estado').nth(1).selectOption('Cumplido')
      await page.getByRole('button', { name: 'Guardar acuerdos' }).click()
    },
  },
  {
    nombre: 'guardar una persona',
    ruta: '/equipo', endpoint: '/rpc/guardar_persona', esperarListo: (page) => expect(ficha(page, 'Dairo Pérez')).toBeVisible(),
    accion: async (page) => {
      await ficha(page, 'Dairo Pérez').getByRole('button', { name: 'Editar' }).click()
      await page.getByRole('button', { name: 'Guardar cambios' }).click()
    },
  },
  {
    nombre: 'eliminar una persona',
    ruta: '/equipo', endpoint: '/rest/v1/persona', esperarListo: (page) => expect(ficha(page, 'Dairo Pérez')).toBeVisible(),
    accion: async (page) => {
      await ficha(page, 'Dairo Pérez').getByRole('button', { name: 'Editar' }).click()
      await page.getByRole('button', { name: 'Eliminar persona' }).click()
      await page.getByRole('button', { name: 'Sí, eliminar' }).click()
    },
  },
  {
    nombre: 'revisar las reglas ahora',
    ruta: '/alertas', endpoint: '/functions/v1/alertas', esperarListo: (page) => expect(page.getByRole('button', { name: 'Revisar reglas y enviar ahora' })).toBeVisible(),
    accion: (page) => page.getByRole('button', { name: 'Revisar reglas y enviar ahora' }).click(),
  },
  {
    nombre: 'ajustar una regla',
    ruta: '/alertas', endpoint: '/rest/v1/regla_alerta', esperarListo: (page) => expect(regla(page, 'Reprogramación')).toBeVisible(),
    accion: async (page) => {
      await regla(page, 'Reprogramación').getByRole('button', { name: 'Ajustar' }).click()
      await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    },
  },
  {
    nombre: 'cancelar alertas de la cola',
    ruta: '/alertas', endpoint: '/rest/v1/alerta_programada', esperarListo: (page) => expect(fila(page, '[Escalamiento] BL-024')).toBeVisible(),
    accion: async (page) => {
      await fila(page, '[Escalamiento] BL-024').click()
      await page.getByRole('button', { name: 'Cancelar seleccionadas' }).click()
    },
  },
  {
    nombre: 'enviar un correo de prueba',
    ruta: '/alertas', endpoint: '/functions/v1/correo', esperarListo: (page) => expect(page.getByRole('heading', { level: 5, name: 'Envío de correos' })).toBeVisible(),
    preparar: async (page, backend) => { backend.estado.smtp.usuario = 'po@ises.com.co'; backend.estado.smtp.password = 'x'; backend.estado.smtp.remitente = 'po@ises.com.co' },
    accion: (page) => page.getByRole('button', { name: 'Enviar prueba' }).click(),
  },
  {
    nombre: 'eliminar una nota de la bitácora',
    ruta: '/backlog', endpoint: '/rest/v1/nota', esperarListo: (page) => expect(fila(page, 'BL-010')).toBeVisible(),
    accion: async (page) => {
      await fila(page, 'BL-010').click()
      await page.locator('section', { has: page.getByRole('heading', { level: 5, name: 'Bitácora' }) }).getByRole('button', { name: 'Eliminar nota' }).first().click()
    },
  },
  {
    nombre: 'guardar los datos del Product Owner',
    ruta: '/configuracion', endpoint: '/rest/v1/config', esperarListo: (page) => expect(page.getByRole('heading', { level: 5, name: 'Product Owner' })).toBeVisible(),
    accion: (page) => page.locator('section', { has: page.getByRole('heading', { level: 5, name: 'Product Owner' }) }).getByRole('button', { name: 'Guardar' }).click(),
  },
  {
    nombre: 'descartar el aviso de inicio',
    ruta: '/', endpoint: '/rest/v1/config', esperarListo: (page) => expect(page.getByRole('button', { name: 'Entendido' })).toBeVisible(),
    accion: (page) => page.getByRole('button', { name: 'Entendido' }).click(),
  },
]

test.describe('Fallos del servidor al ejecutar acciones', () => {
  for (const caso of CASOS) {
    test(`informa al usuario cuando falla: ${caso.nombre}`, async ({ paginaAutenticada: page, backend }) => {
      await caso.preparar?.(page, backend)
      await abrir(page, caso.ruta)
      await caso.esperarListo(page)
      backend.fallarConsulta(caso.endpoint, { mensaje: MENSAJE, metodos: ['POST', 'PATCH', 'DELETE'] })
      await caso.accion(page)
      await expect(page.getByText(MENSAJE).first()).toBeVisible({ timeout: 4000 })
    })
  }
})
