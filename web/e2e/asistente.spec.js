import { abrir, expect, test } from './support/fixtures.js'

const entrada = (page) => page.getByPlaceholder(/^Pregunta sobre tu backlog/)

async function preguntar(page, texto) {
  await entrada(page).fill(texto)
  await page.getByRole('button', { name: 'Enviar', exact: true }).click()
}

test.describe('IA Asistente', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/asistente')
    await expect(entrada(page)).toBeVisible()
  })

  test('muestra la bienvenida, la insignia local y las preguntas rápidas', async ({ paginaAutenticada: page }) => {
    await expect(page.getByText('Asistente local · sin API key')).toBeVisible()
    await expect(page.getByText('Hola, soy tu copiloto.')).toBeVisible()
    await expect(page.getByRole('button', { name: '¿Qué está en riesgo?' })).toBeVisible()
    await expect(page.getByRole('button', { name: '¿Cómo está la carga del equipo?' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar', exact: true })).toBeDisabled()
  })

  test('una pregunta rápida responde con los datos y propone un recordatorio', async ({ paginaAutenticada: page }) => {
    await page.getByRole('button', { name: '¿Qué está atrasado?' }).click()
    await expect(page.getByText('6 ítem(s) atrasados')).toBeVisible()
    await expect(page.getByText('Rutas de supervisión').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar recordatorio a los responsables (6)' })).toBeVisible()
  })

  test('ejecutar el recordatorio muestra el resultado y no permite repetirlo', async ({ paginaAutenticada: page }) => {
    await page.getByRole('button', { name: '¿Qué está atrasado?' }).click()
    await page.getByRole('button', { name: 'Enviar recordatorio a los responsables (6)' }).click()
    await expect(page.getByText('2 correo(s) de recordatorio enviados (uno por responsable).')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar recordatorio a los responsables (6)' })).toHaveCount(0)
  })

  test('consulta el estado de un ítem y escala su bloqueo', async ({ paginaAutenticada: page, backend }) => {
    await preguntar(page, '¿Cómo va BL-024?')
    await expect(page.getByText('BL-024 Control de acceso')).toBeVisible()
    await expect(page.getByText('Falta acceso al servidor del cliente').first()).toBeVisible()
    await page.getByRole('button', { name: 'Escalar el bloqueo de BL-024' }).click()
    await expect(page.getByText('Escalamiento enviado.')).toBeVisible()
    expect(backend.estado.bloqueante.find((b) => b.item_id === 24).escalado_en).not.toBeNull()
  })

  test('un ítem inexistente se informa', async ({ paginaAutenticada: page }) => {
    await preguntar(page, 'estado de BL-999')
    await expect(page.getByText('No encontré el ítem BL-999.')).toBeVisible()
  })

  test('responde por cliente', async ({ paginaAutenticada: page }) => {
    await page.getByRole('button', { name: '¿Cómo va ACUACAR?' }).click()
    await expect(page.getByText(/ACUACAR · \d+ de 6 ítems terminados/)).toBeVisible()
  })

  test('redacta el borrador de escalamiento de un bloqueo concreto', async ({ paginaAutenticada: page }) => {
    await preguntar(page, 'escala BL-025')
    await expect(page.getByText('Borrador de escalamiento para BL-025')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Enviar este escalamiento \(\d+ destinatario\/s\)$/ })).toBeVisible()
  })

  test('prepara el resumen semanal y lo envía', async ({ paginaAutenticada: page, backend }) => {
    await page.getByRole('button', { name: 'Prepara el resumen semanal para stakeholders' }).click()
    await expect(page.getByText('Resumen semanal del plan de trabajo')).toBeVisible()
    await page.getByRole('button', { name: /^Enviar el resumen ahora/ }).click()
    await expect(page.getByText(/Resumen enviado a \d+ destinatario\(s\)\./)).toBeVisible()
    expect(backend.estado.alerta_programada.some((a) => a.regla_codigo === 'RESUMEN_SEMANAL' && a.asunto.includes('[Resumen semanal] Plan de trabajo'))).toBe(true)
  })

  test('informa la carga del equipo', async ({ paginaAutenticada: page }) => {
    await page.getByRole('button', { name: '¿Cómo está la carga del equipo?' }).click()
    await expect(page.getByText('Carga del equipo (ítems abiertos)')).toBeVisible()
    await expect(page.getByText('Dairo Pérez').first()).toBeVisible()
  })

  test('consulta a una persona por su nombre', async ({ paginaAutenticada: page }) => {
    await preguntar(page, '¿qué tiene Dairo?')
    await expect(page.getByText(/Dairo Pérez.*ítem\(s\) abiertos/)).toBeVisible()
  })

  test('una pregunta desconocida devuelve la ayuda', async ({ paginaAutenticada: page }) => {
    await preguntar(page, 'zxcv qwer')
    await expect(page.getByText('No estoy seguro de qué necesitas.')).toBeVisible()
    await expect(page.getByText('Puedo ayudarte con:').first()).toBeVisible()
  })

  test('enviar con Enter funciona y limpia la caja', async ({ paginaAutenticada: page }) => {
    await entrada(page).fill('¿Qué está en riesgo?')
    await entrada(page).press('Enter')
    await expect(page.getByText('Riesgos del plan de trabajo')).toBeVisible()
    await expect(entrada(page)).toHaveValue('')
  })

  test('«Nueva conversación» limpia el chat', async ({ paginaAutenticada: page }) => {
    await preguntar(page, '¿Qué está en riesgo?')
    await expect(page.getByText('Riesgos del plan de trabajo')).toBeVisible()
    await page.getByRole('button', { name: 'Nueva conversación' }).click()
    await expect(page.getByText('Riesgos del plan de trabajo')).toHaveCount(0)
    await expect(page.getByText('Hola, soy tu copiloto.')).toBeVisible()
  })

  test('un fallo al ejecutar una acción se muestra en el chat', async ({ paginaAutenticada: page, backend }) => {
    backend.fallarConsulta('/functions/v1/alertas', { mensaje: 'servicio caído' })
    await page.getByRole('button', { name: '¿Qué está atrasado?' }).click()
    await page.getByRole('button', { name: 'Enviar recordatorio a los responsables (6)' }).click()
    await expect(page.getByText(/No se pudo ejecutar/)).toBeVisible()
  })
})
