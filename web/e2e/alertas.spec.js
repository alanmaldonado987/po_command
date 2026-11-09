import { abrir, expect, kpi, tarjeta, test, toast } from './support/fixtures.js'

const regla = (page, nombre) => page.locator('article', { has: page.getByRole('heading', { level: 5, name: nombre }) })
const filaCola = (page, texto) => tarjeta(page, 'Cola de envíos').getByRole('row').filter({ hasText: texto })
const casillaConfirmar = (page) => page.getByRole('checkbox', { name: /Entiendo que desde ahora/ })
const campoClave = (page) => page.getByLabel(/^Contraseña o contraseña de aplicación/)

async function configurarCorreo(page, clave = 'clave-de-prueba') {
  await campoClave(page).fill(clave)
  await page.getByRole('button', { name: 'Guardar y probar conexión' }).click()
}

test.describe('Alertas · reglas y KPIs', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/alertas')
    await expect(page.getByRole('heading', { level: 5, name: 'Cola de envíos' })).toBeVisible()
  })

  test('muestra el estado del correo y los KPIs', async ({ paginaAutenticada: page }) => {
    await expect(page.getByText('Correo en simulación').first()).toBeVisible()
    await expect(kpi(page, 'Reglas activas')).toContainText('8 / 8')
    await expect(kpi(page, 'En cola')).toContainText('3')
    await expect(kpi(page, 'Fallidas')).toContainText('2')
  })

  test('lista las ocho reglas con su categoría y destinatarios', async ({ paginaAutenticada: page }) => {
    await expect(page.locator('article')).toHaveCount(8)
    const escalamiento = regla(page, 'Escalamiento de bloqueante')
    await expect(escalamiento).toContainText('Categoría Escalamientos · 48 horas bloqueada')
    await expect(escalamiento).toContainText('Stakeholders del cliente')
    await expect(escalamiento).toContainText('Líder técnico / DevOps')
    await expect(regla(page, 'Resumen semanal')).toContainText('07:30')
  })

  test('desactivar una regla actualiza el contador', async ({ paginaAutenticada: page, backend }) => {
    await regla(page, 'Nuevo bloqueante').getByRole('switch', { name: 'Activa' }).click()
    await expect(kpi(page, 'Reglas activas')).toContainText('7 / 8')
    expect(backend.estado.regla_alerta.find((r) => r.codigo === 'BLOQUEO_NUEVO').activa).toBe(false)
    await regla(page, 'Nuevo bloqueante').getByRole('switch', { name: 'Activa' }).click()
    await expect(kpi(page, 'Reglas activas')).toContainText('8 / 8')
  })

  test('ajusta el parámetro, la hora y los destinatarios de una regla', async ({ paginaAutenticada: page, backend }) => {
    const escalamiento = regla(page, 'Escalamiento de bloqueante')
    await escalamiento.getByRole('button', { name: 'Ajustar' }).click()
    await page.getByLabel('Parámetro (horas bloqueada)').fill('72')
    await page.getByLabel('Hora de envío (HH:MM)').fill('09:30')
    await page.getByRole('button', { name: 'Equipo', exact: true }).click()
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(toast(page, 'Regla «Escalamiento de bloqueante» actualizada.')).toBeVisible()
    expect(backend.estado.regla_alerta.find((r) => r.codigo === 'BLOQUEO_ESCALAR')).toMatchObject({ parametro: 72, hora_envio: '09:30' })
    expect(backend.estado.regla_alerta.find((r) => r.codigo === 'BLOQUEO_ESCALAR').destinatarios).toContain('equipo')
    await expect(escalamiento).toContainText('72 horas bloqueada · 09:30')
  })

  test('una hora inválida se reemplaza por 08:00', async ({ paginaAutenticada: page, backend }) => {
    await regla(page, 'Vencimiento de fecha planificada').getByRole('button', { name: 'Ajustar' }).click()
    await page.getByLabel('Hora de envío (HH:MM)').fill('25:99')
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(toast(page, 'actualizada.')).toBeVisible()
    expect(backend.estado.regla_alerta.find((r) => r.codigo === 'VENCIMIENTO').hora_envio).toBe('08:00')
  })

  test('«Revisar reglas y enviar ahora» informa el resultado', async ({ paginaAutenticada: page }) => {
    await page.getByRole('button', { name: 'Revisar reglas y enviar ahora' }).click()
    await expect(toast(page, /Revisión completa: 1 alerta\(s\) nuevas, \d+ enviada\(s\), 0 fallida\(s\)\./)).toBeVisible()
  })

  test('el historial lista los envíos registrados', async ({ paginaAutenticada: page }) => {
    const historial = tarjeta(page, 'Historial')
    await expect(historial).toContainText('[Bloqueante] BL-024 AIR-E · Control de acceso')
    await expect(historial).toContainText('SMTPAuthError: 535 credenciales')
  })
})

test.describe('Alertas · cola de envíos', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/alertas')
    await expect(filaCola(page, '[Escalamiento] BL-024')).toBeVisible()
  })

  test('muestra las pendientes y permite ver la vista previa del correo', async ({ paginaAutenticada: page }) => {
    await expect(tarjeta(page, 'Cola de envíos').getByRole('row').filter({ has: page.getByRole('cell') })).toHaveCount(3)
    await expect(page.getByText('Selecciona una fila para ver la vista previa del correo.')).toBeVisible()
    await filaCola(page, '[Escalamiento] BL-024').click()
    const vista = page.frameLocator('iframe[title="Vista previa del correo"]')
    await expect(vista.getByRole('heading', { name: '[Escalamiento] BL-024 AIR-E bloqueado 96 h' })).toBeVisible()
  })

  test('la vista previa se ejecuta en un iframe aislado', async ({ paginaAutenticada: page }) => {
    await filaCola(page, '[Escalamiento] BL-024').click()
    await expect(page.locator('iframe[title="Vista previa del correo"]')).toHaveAttribute('sandbox', '')
  })

  test('cancela las alertas seleccionadas', async ({ paginaAutenticada: page, backend }) => {
    await expect(page.getByRole('button', { name: 'Cancelar seleccionadas' })).toBeDisabled()
    await filaCola(page, '[Escalamiento] BL-024').click()
    await filaCola(page, '[Vencimientos] Dairo Pérez').click()
    await page.getByRole('button', { name: 'Cancelar seleccionadas' }).click()
    await expect(filaCola(page, '[Escalamiento] BL-024')).toHaveCount(0)
    expect(backend.estado.alerta_programada.filter((a) => a.estado === 'Cancelada')).toHaveLength(3)
    await expect(kpi(page, 'En cola')).toContainText('1')
  })

  test('reintenta una alerta fallida', async ({ paginaAutenticada: page, backend }) => {
    await page.getByRole('button', { name: 'Fallida', exact: true }).click()
    await expect(filaCola(page, '[Reprogramación] BL-009')).toContainText('SMTPAuthError: 535 credenciales')
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeDisabled()
    await filaCola(page, '[Reprogramación] BL-009').click()
    await page.getByRole('button', { name: 'Reintentar' }).click()
    await expect(toast(page, 'Reintento: 1 enviada(s), 0 fallida(s).')).toBeVisible()
    await expect(filaCola(page, '[Reprogramación] BL-009')).toHaveCount(0)
    expect(backend.estado.alerta_programada.find((a) => a.id === 4).estado).toBe('Enviada')
  })

  test('los estados sin registros muestran un mensaje', async ({ paginaAutenticada: page, backend }) => {
    backend.estado.alerta_programada = backend.estado.alerta_programada.filter((a) => a.estado !== 'Enviada')
    await page.getByRole('button', { name: 'Enviada', exact: true }).click()
    await expect(page.getByText('Sin registros en este estado.')).toBeVisible()
  })

  test('cambiar de estado limpia la selección', async ({ paginaAutenticada: page }) => {
    await filaCola(page, '[Escalamiento] BL-024').click()
    await page.getByRole('button', { name: 'Cancelada', exact: true }).click()
    await expect(page.locator('iframe[title="Vista previa del correo"]')).toHaveCount(0)
  })
})

test.describe('Alertas · envío de correos', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/alertas')
    await expect(page.getByRole('heading', { level: 5, name: 'Envío de correos' })).toBeVisible()
  })

  test('sin configurar no ofrece activar el envío real', async ({ paginaAutenticada: page }) => {
    await expect(page.getByRole('button', { name: 'Activar envío real' })).toHaveCount(0)
    await expect(page.getByPlaceholder('tu@ises.com.co')).toHaveValue('vrodriguez@ises.com.co')
  })

  test('cambiar de proveedor ajusta servidor, puerto y seguridad', async ({ paginaAutenticada: page }) => {
    await page.getByRole('button', { name: 'Gmail / Google Workspace' }).click()
    await page.getByText('Servidor (avanzado)').click()
    await expect(page.getByLabel('Servidor SMTP')).toHaveValue('smtp.gmail.com')
    await expect(page.getByLabel('Puerto')).toHaveValue('587')
  })

  test('guarda y prueba la conexión correctamente', async ({ paginaAutenticada: page, backend }) => {
    await configurarCorreo(page)
    await expect(page.getByText('Conexión correcta con smtp.office365.com como vrodriguez@ises.com.co.')).toBeVisible()
    expect(backend.estado.smtp).toMatchObject({ usuario: 'vrodriguez@ises.com.co', password: 'clave-de-prueba' })
    await expect(campoClave(page)).toHaveAttribute('placeholder', '•••••••• (guardada)')
    await expect(campoClave(page)).toHaveValue('')
  })

  test('traduce el error de conexión y muestra el detalle técnico', async ({ paginaAutenticada: page, backend }) => {
    backend.estado.fallas.smtp = {
      detalle: 'SMTPAuthenticationError: 535 5.7.3 Authentication unsuccessful',
      explicacion: 'Usuario o contraseña rechazados. Si tu cuenta tiene verificación en dos pasos (MFA), necesitas una contraseña de aplicación.',
    }
    await configurarCorreo(page, 'mala')
    await expect(page.getByText('Usuario o contraseña rechazados.')).toBeVisible()
    await expect(page.getByText('Detalle: SMTPAuthenticationError: 535 5.7.3 Authentication unsuccessful')).toBeVisible()
  })

  test('no permite activar el envío real sin una prueba exitosa', async ({ paginaAutenticada: page }) => {
    await configurarCorreo(page)
    await expect(casillaConfirmar(page)).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Activar envío real' })).toBeDisabled()
    await expect(page.getByText('El botón se habilita después de un correo de prueba exitoso.')).toBeVisible()
  })

  test('una prueba de correo fallida mantiene bloqueada la activación', async ({ paginaAutenticada: page, backend }) => {
    backend.estado.fallas.pruebaCorreo = { detalle: 'Timeout: connection refused', explicacion: 'No hay conexión con el servidor.' }
    await configurarCorreo(page)
    await page.getByRole('button', { name: 'Enviar prueba' }).click()
    await expect(page.getByText('No hay conexión con el servidor.')).toBeVisible()
    await expect(casillaConfirmar(page)).toBeDisabled()
  })

  test('flujo completo: probar, confirmar, activar y volver a simulación', async ({ paginaAutenticada: page, backend }) => {
    await configurarCorreo(page)
    await page.getByRole('button', { name: 'Enviar prueba' }).click()
    await expect(page.getByText(/Enviado a vrodriguez@ises.com.co\. Revisa tu bandeja/)).toBeVisible()
    expect(backend.estado.correosDePrueba).toEqual(['vrodriguez@ises.com.co'])

    await expect(page.getByRole('button', { name: 'Activar envío real' })).toBeDisabled()
    await casillaConfirmar(page).check()
    await page.getByRole('button', { name: 'Activar envío real' }).click()
    await expect(toast(page, 'Envío real activado: las próximas alertas saldrán por correo.')).toBeVisible()
    await expect(page.getByText('Envío real activo')).toBeVisible()
    await expect(page.getByText('SMTP activo')).toBeVisible()
    expect(backend.estado.smtp.dry_run).toBe(false)

    await page.getByRole('button', { name: 'Volver a modo simulación' }).click()
    await expect(toast(page, 'Modo simulación activado: no saldrán correos reales.')).toBeVisible()
    expect(backend.estado.smtp.dry_run).toBe(true)
    expect(backend.estado.auditoria.map((a) => a.accion)).toEqual(expect.arrayContaining(['activar', 'desactivar']))
  })

  test('advierte de personas con el correo de ejemplo @empresa.co', async ({ paginaAutenticada: page }) => {
    await configurarCorreo(page)
    await expect(page.getByText(/1 persona\(s\) tienen el correo de ejemplo @empresa\.co \(Ana Torres\)/)).toBeVisible()
    await expect(page.getByText('1 persona(s) sin correo: sus alertas te llegarán a ti.')).toBeVisible()
  })

  test('un destino de prueba inválido informa el error al usuario (H-02)', async ({ paginaAutenticada: page }) => {
    await configurarCorreo(page)
    await page.getByLabel('Enviar un correo de prueba real a').fill('no-es-un-correo')
    await page.getByRole('button', { name: 'Enviar prueba' }).click()
    await expect(page.getByText(/Correo de destino inválido/)).toBeVisible({ timeout: 3000 })
  })
})
