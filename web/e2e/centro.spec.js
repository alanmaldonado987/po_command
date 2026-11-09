import { ESPERADO } from './support/datosSemilla.js'
import { abrir, expect, kpi, tarjeta, test } from './support/fixtures.js'

const abiertosDe = (backend, nombre) =>
  backend.estado.item.filter((i) => !i.eliminado_en && !['Terminado', 'Suspendido'].includes(i.estado) &&
    backend.estado.persona.find((p) => p.id === i.responsable_id)?.nombre === nombre).length

test.describe('Centro de Mando', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/')
    await expect(page.getByText('Bloqueantes activos')).toBeVisible()
  })

  test('el encabezado resume bloqueantes y alertas en cola', async ({ paginaAutenticada: page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Centro de Mando' })).toBeVisible()
    await expect(page.getByText(`${ESPERADO.bloqueantes} bloqueante(s) requieren tu atención y ${ESPERADO.alertasEnCola} alerta(s) esperan en cola.`)).toBeVisible()
    await expect(page.getByText('Correo en simulación')).toBeVisible()
  })

  test('los KPIs son coherentes con los datos sembrados', async ({ paginaAutenticada: page, backend }) => {
    const avance = Math.round((ESPERADO.terminados / ESPERADO.items) * 100)
    await expect(kpi(page, 'Clientes')).toContainText(`${ESPERADO.clientes}`)
    await expect(kpi(page, 'Clientes')).toContainText(`${ESPERADO.items} ítems en el plan`)
    await expect(kpi(page, 'Avance')).toContainText(`${avance}%`)
    await expect(kpi(page, 'Avance')).toContainText(`${ESPERADO.terminados} terminados · ${ESPERADO.enPruebas} en pruebas`)
    await expect(kpi(page, 'Atrasados')).toContainText(String(ESPERADO.atrasados))
    await expect(kpi(page, 'Atrasados')).toContainText(`de ${ESPERADO.abiertos} ítems abiertos`)
    await expect(kpi(page, 'Bloqueantes')).toContainText(String(ESPERADO.bloqueantes))
    await expect(kpi(page, 'Bloqueantes')).toContainText('1 con atraso')
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0)
    const enviadasHoy = backend.estado.notificacion_log.filter((l) => l.estado === 'Enviada' && new Date(l.fecha) >= inicioDia).length
    await expect(kpi(page, 'Alertas hoy')).toContainText(String(enviadasHoy))
    await expect(kpi(page, 'Alertas hoy')).toContainText(`${ESPERADO.alertasFallidas} fallida(s) por revisar`)
  })

  test('lista los bloqueantes activos con responsable y motivo', async ({ paginaAutenticada: page }) => {
    const bloqueantes = tarjeta(page, 'Bloqueantes activos')
    await expect(bloqueantes).toContainText('BL-024')
    await expect(bloqueantes).toContainText('Falta acceso al servidor del cliente')
    await expect(bloqueantes).toContainText('BL-025')
    await expect(bloqueantes.getByText('Sin escalar')).toHaveCount(2)
    await expect(bloqueantes.getByRole('button', { name: 'Escalar' })).toHaveCount(2)
  })

  test('escalar un bloqueo envía la alerta y lo marca como escalado', async ({ paginaAutenticada: page, backend }) => {
    const bloqueantes = tarjeta(page, 'Bloqueantes activos')
    await bloqueantes.getByRole('button', { name: 'Escalar' }).first().click()
    await expect(page.getByText('Escalamiento enviado.')).toBeVisible()
    await expect(bloqueantes.getByText('Sin escalar')).toHaveCount(1)
    expect(backend.estado.bloqueante.find((b) => b.id === 1).escalado_en).not.toBeNull()
    expect(backend.estado.alerta_programada.some((a) => a.regla_codigo === 'BLOQUEO_ESCALAR' && a.estado === 'Enviada' && a.asunto.includes('BL-024'))).toBe(true)
  })

  test('resolver un bloqueo lo retira de la lista y actualiza el KPI', async ({ paginaAutenticada: page, backend }) => {
    const bloqueantes = tarjeta(page, 'Bloqueantes activos')
    await bloqueantes.getByRole('button', { name: 'Resolver' }).first().click()
    await expect(page.getByText('Bloqueo resuelto: se avisa al equipo y se cancelan los escalamientos.')).toBeVisible()
    await expect(bloqueantes.getByText('BL-024')).toHaveCount(0)
    await expect(kpi(page, 'Bloqueantes')).toContainText(String(ESPERADO.bloqueantes - 1))
    expect(backend.estado.item.find((i) => i.codigo === 'BL-024').bloqueado).toBe(false)
    expect(backend.estado.nota.some((n) => n.item_id === 24 && n.texto.startsWith('Bloqueo resuelto'))).toBe(true)
  })

  test('sin bloqueos muestra el estado vacío', async ({ paginaAutenticada: page, backend }) => {
    backend.estado.bloqueante.forEach((b) => { b.resuelto_en = new Date().toISOString() })
    await page.reload()
    await expect(page.getByText('No hay bloqueos abiertos.')).toBeVisible()
  })

  test('el aviso de inicio se descarta con «Entendido»', async ({ paginaAutenticada: page, backend }) => {
    await expect(page.getByText(/Se cargaron 25 ítems de tu Plan de Trabajo/)).toBeVisible()
    await page.getByRole('button', { name: 'Entendido' }).click()
    await expect(page.getByText(/Se cargaron 25 ítems/)).toHaveCount(0)
    expect(backend.estado.config.aviso_inicio).toBe('')
  })

  test('muestra las próximas alertas y enlaza a la gestión', async ({ paginaAutenticada: page }) => {
    const proximas = tarjeta(page, 'Próximas alertas')
    await expect(proximas.getByText('[Escalamiento] BL-024 AIR-E bloqueado 96 h')).toBeVisible()
    await expect(proximas.getByText('Para: carlos.gomez@air-e.com, vrodriguez@ises.com.co')).toBeVisible()
    await proximas.getByRole('link', { name: 'Gestionar reglas y cola' }).click()
    await expect(page).toHaveURL(/\/alertas$/)
  })

  test('la carga por responsable coincide con los ítems abiertos', async ({ paginaAutenticada: page, backend }) => {
    const carga = tarjeta(page, 'Carga por responsable')
    for (const nombre of ['Dairo Pérez', 'Luis Kendor Narváez']) {
      await expect(carga.locator('div.rounded-xl', { hasText: nombre })).toContainText(`${abiertosDe(backend, nombre)} abiertos`)
    }
    await expect(carga).toContainText('Sin asignar')
  })

  test('los atrasados y por vencer aparecen con su chip', async ({ paginaAutenticada: page }) => {
    const vencimientos = tarjeta(page, 'Atrasados y por vencer')
    await expect(vencimientos.getByText('Rutas de supervisión')).toBeVisible()
    await expect(vencimientos.getByText('Por vencer').first()).toBeVisible()
    await expect(vencimientos.getByText(/\d+ día\(s\) de atraso/).first()).toBeVisible()
  })

  test('las gráficas de estado y avance por cliente se renderizan', async ({ paginaAutenticada: page }) => {
    await expect(tarjeta(page, 'Estado de los ítems').locator('svg').first()).toBeVisible()
    await expect(tarjeta(page, 'Avance por cliente').locator('svg').first()).toBeVisible()
  })

  test('la actividad de notificaciones lista los envíos recientes', async ({ paginaAutenticada: page }) => {
    const actividad = tarjeta(page, 'Actividad de notificaciones')
    await expect(actividad.getByText('[Bloqueante] BL-025 ELECTROHUILA · Sincronización offline')).toBeVisible()
    await expect(actividad.getByText('Fallida').first()).toBeVisible()
  })
})

test('un error en la consulta de ítems muestra el estado de error', async ({ paginaAutenticada: page, backend }) => {
  backend.fallarConsulta('/rest/v1/v_item', { mensaje: 'falla simulada' })
  await page.goto('/')
  await expect(page.getByText('No se pudieron cargar los datos: falla simulada')).toBeVisible()
})

test('mientras carga muestra el indicador de carga', async ({ paginaAutenticada: page, backend }) => {
  backend.retardoMs = 800
  await page.goto('/')
  await expect(page.getByText('Cargando…').first()).toBeVisible()
  await expect(page.getByText('Bloqueantes activos')).toBeVisible()
})
