import { abrir, expect, kpi, tarjeta, test, toast } from './support/fixtures.js'

const MAPEO = {
  'No iniciado': 'PENDIENTE',
  'En curso': 'EN DESARROLLO',
  'Terminado, en etapa de pruebas': 'VALIDACIÓN',
  Terminado: 'ENTREGADO',
  Suspendido: 'CERRADO',
}
const EQUIPO = { id: 't1', nombre: 'Ises' }

const fila = (page, codigo) => page.getByRole('row').filter({ hasText: codigo })
const campoSelect = (contenedor, etiqueta) =>
  contenedor.locator('label', { has: contenedor.page().locator('span.field-label', { hasText: new RegExp(`^${etiqueta}$`) }) }).locator('select')
const marcarEstado = async (contenedor, estadoApp, estadoClickUp) => {
  await contenedor.getByRole('button', { name: estadoApp, exact: true }).click()
  await contenedor.getByRole('checkbox', { name: estadoClickUp, exact: true }).check()
  await contenedor.page().keyboard.press('Escape')
}
const irAMenu = (page, nombre) => page.locator('aside').getByRole('link', { name: nombre, exact: true }).click()

function conectar(backend, { habilitado = false, conDestino = false } = {}) {
  Object.assign(backend.estado.clickup, { token: 'pk_guardado', equipo: EQUIPO, habilitado, mapeo_estados: MAPEO })
  if (conDestino) {
    backend.estado.clickup_destino.push({ id: 1, tablero_id: null, cliente_id: null, lista_id: 'l9', lista_nombre: 'Innovación y Desarrollo OTC / Backlog Dev' })
  }
}

async function abrirClickUp(page) {
  await abrir(page, '/configuracion')
  await page.getByRole('tab', { name: 'ClickUp' }).click()
  await expect(page.getByRole('heading', { level: 5, name: 'Conexión' })).toBeVisible()
}

async function elegirLista(page, titulo, { carpeta, lista }) {
  await page.getByLabel(`Espacio de ${titulo}`).selectOption({ label: 'Innovación y Desarrollo OTC' })
  await page.getByLabel(`Carpeta de ${titulo}`).selectOption({ label: carpeta })
  await page.getByLabel(`Lista de ${titulo}`).selectOption({ label: lista })
}

test.describe('ClickUp · conexión', () => {
  test('sin configurar la pestaña guía el primer paso', async ({ paginaAutenticada: page }) => {
    await abrirClickUp(page)
    await expect(page.getByText(/La sincronización con ClickUp está desactivada\./)).toContainText('Guarda tu token personal')
    await expect(page.getByRole('button', { name: 'Guardar y probar' })).toBeDisabled()
    await expect(page.getByRole('switch', { name: 'Sincronización activa' })).toBeDisabled()
  })

  test('guarda el token, prueba la conexión y elige el equipo sin exponer el token', async ({ paginaAutenticada: page, backend }) => {
    await abrirClickUp(page)
    await page.getByLabel(/Token personal de ClickUp/).fill('pk_secreto_123')
    await page.getByRole('button', { name: 'Guardar y probar' }).click()
    await expect(page.getByText('Conexión correcta como vero@ises.com.co. Equipos disponibles: 1.')).toBeVisible()
    expect(backend.estado.clickup.token).toBe('pk_secreto_123')
    await expect(page.getByLabel(/Token personal de ClickUp/)).toHaveValue('')
    await expect(page.getByLabel(/Token personal de ClickUp/)).toHaveAttribute('placeholder', '•••••••• (guardado)')

    await page.getByLabel('Equipo de trabajo').selectOption({ label: 'Ises' })
    await expect(toast(page, 'Equipo guardado.')).toBeVisible()
    expect(backend.estado.clickup.equipo).toEqual(EQUIPO)
    await expect(page.locator('body')).not.toContainText('pk_secreto_123')
  })

  test('un token rechazado se informa y no habilita nada', async ({ paginaAutenticada: page, backend }) => {
    backend.estado.fallas.clickup = true
    await abrirClickUp(page)
    await page.getByLabel(/Token personal de ClickUp/).fill('pk_malo')
    await page.getByRole('button', { name: 'Guardar y probar' }).click()
    await expect(page.getByText(/ClickUp rechazó el token/)).toBeVisible()
    await expect(page.getByLabel('Equipo de trabajo')).toBeEnabled()
    expect(backend.estado.clickup.habilitado).toBe(false)
  })

  test('activar la sincronización pide confirmación y se puede cancelar', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    await abrirClickUp(page)
    const interruptor = page.getByRole('switch', { name: 'Sincronización activa' })
    await interruptor.click()
    await expect(page.getByText(/Al activar la sincronización/)).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    expect(backend.estado.clickup.habilitado).toBe(false)

    await interruptor.click()
    await page.getByRole('button', { name: 'Sí, activar' }).click()
    await expect(toast(page, 'Sincronización activada.')).toBeVisible()
    await expect(interruptor).toHaveAttribute('aria-checked', 'true')
    expect(backend.estado.clickup.habilitado).toBe(true)
  })

  test('desactivar avisa de que se detiene la sincronización', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend, { habilitado: true })
    await abrirClickUp(page)
    await page.getByRole('switch', { name: 'Sincronización activa' }).click()
    await expect(page.getByText(/Al desactivarla, los cambios dejan de sincronizarse/)).toBeVisible()
    await page.getByRole('button', { name: 'Sí, desactivar' }).click()
    await expect(toast(page, 'Sincronización desactivada.')).toBeVisible()
    expect(backend.estado.clickup.habilitado).toBe(false)
  })
})

test.describe('ClickUp · destinos y estados', () => {
  test.beforeEach(async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    backend.estado.clickup.mapeo_estados = {}
    await abrirClickUp(page)
  })

  test('el selector en cascada habilita carpeta y lista paso a paso', async ({ paginaAutenticada: page }) => {
    await expect(page.getByLabel('Carpeta de AIR-E')).toBeDisabled()
    await page.getByLabel('Espacio de AIR-E').selectOption({ label: 'Innovación y Desarrollo OTC' })
    await expect(page.getByLabel('Carpeta de AIR-E')).toBeEnabled()
    await expect(page.getByLabel('Lista de AIR-E')).toBeDisabled()
    await page.getByLabel('Carpeta de AIR-E').selectOption({ label: 'Plan de Trabajo' })
    await expect(page.getByLabel('Lista de AIR-E')).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Guardar destino de AIR-E' })).toBeDisabled()
    await page.getByLabel('Lista de AIR-E').selectOption({ label: 'AIR-E' })
    await expect(page.getByRole('button', { name: 'Guardar destino de AIR-E' })).toBeEnabled()
  })

  test('guarda el destino por defecto y el de un cliente, y los muestra como actuales', async ({ paginaAutenticada: page, backend }) => {
    await elegirLista(page, 'Destino por defecto', { carpeta: 'Sin carpeta', lista: 'Backlog Dev' })
    await page.getByRole('button', { name: 'Guardar destino de Destino por defecto' }).click()
    await expect(toast(page, 'Destino de Destino por defecto guardado.')).toBeVisible()
    await expect(page.getByText('Lista actual: Innovación y Desarrollo OTC / Backlog Dev')).toBeVisible()
    await expect(page.getByText('Usa el destino por defecto').first()).toBeVisible()

    await elegirLista(page, 'AIR-E', { carpeta: 'Plan de Trabajo', lista: 'AIR-E' })
    await page.getByRole('button', { name: 'Guardar destino de AIR-E' }).click()
    await expect(toast(page, 'Destino de AIR-E guardado.')).toBeVisible()
    expect(backend.estado.clickup_destino.map((d) => [d.cliente_id, d.lista_id])).toEqual([[null, 'l9'], [1, 'l1']])
  })

  test('quitar un destino lo elimina', async ({ paginaAutenticada: page, backend }) => {
    await elegirLista(page, 'AIR-E', { carpeta: 'Plan de Trabajo', lista: 'AIR-E' })
    await page.getByRole('button', { name: 'Guardar destino de AIR-E' }).click()
    await page.getByRole('button', { name: 'Quitar destino de AIR-E' }).click()
    await expect(toast(page, 'Destino de AIR-E quitado.')).toBeVisible()
    expect(backend.estado.clickup_destino).toEqual([])
  })

  test('el mapeo de estados exige los cinco y se guarda', async ({ paginaAutenticada: page, backend }) => {
    const estados = tarjeta(page, 'Estados').last()
    const guardar = estados.getByRole('button', { name: 'Guardar mapeo' })
    await expect(guardar).toBeDisabled()
    for (const [estadoApp, estadoClickUp] of Object.entries(MAPEO)) {
      await marcarEstado(estados, estadoApp, estadoClickUp)
    }
    await expect(guardar).toBeEnabled()
    await guardar.click()
    await expect(toast(page, 'Mapeo de estados guardado.')).toBeVisible()
    expect(backend.estado.clickup.mapeo_estados).toEqual(MAPEO)
  })
})

test.describe('ClickUp · webhook y sincronización', () => {
  test('registra y quita el webhook', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend, { habilitado: true })
    await abrirClickUp(page)
    await expect(kpi(page, 'Webhook')).toContainText('Sin registrar')
    await page.getByRole('button', { name: 'Registrar webhook' }).click()
    await expect(toast(page, 'Webhook registrado')).toBeVisible()
    await expect(kpi(page, 'Webhook')).toContainText('Activo')
    await page.getByRole('button', { name: 'Quitar webhook' }).click()
    await expect(toast(page, 'Webhook quitado')).toBeVisible()
    await expect(kpi(page, 'Webhook')).toContainText('Sin registrar')
  })

  test('sincronizar y reconciliar informan el resultado', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend, { habilitado: true })
    await abrirClickUp(page)
    await page.getByRole('button', { name: 'Sincronizar ahora' }).click()
    await expect(toast(page, '0 cambio(s) procesado(s), 0 con error.')).toBeVisible()
    await page.getByRole('button', { name: 'Reconciliar', exact: true }).click()
    await expect(toast(page, 'Reconciliación: 0 creada(s), 0 actualizada(s), 0 archivada(s).')).toBeVisible()
  })

  test('sincronizar y reconciliar quedan deshabilitados con la sincronización apagada', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    await abrirClickUp(page)
    await expect(page.getByRole('button', { name: 'Sincronizar ahora' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Reconciliar', exact: true })).toBeDisabled()
  })

  test('un fallo de ClickUp al sincronizar se muestra al usuario', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend, { habilitado: true })
    await abrirClickUp(page)
    backend.fallarConsulta('/functions/v1/clickup', { estado: 500, mensaje: 'ClickUp limitó las llamadas', metodos: ['POST'] })
    await page.getByRole('button', { name: 'Sincronizar ahora' }).click()
    await expect(toast(page, 'ClickUp limitó las llamadas')).toBeVisible()
  })
})

test.describe('ClickUp · ítems del backlog', () => {
  async function crearItem(page) {
    await abrir(page, '/backlog')
    await page.getByRole('button', { name: 'Nuevo ítem' }).click()
    await page.getByLabel('Cliente *').fill('AIR-E')
    await page.getByLabel('Actividad *').fill('SCR')
    await page.getByLabel('Módulo / componente *').fill('Órdenes')
    await page.getByLabel('Menú / funcionalidad *').fill('Prueba de ClickUp')
    await page.getByLabel('Alcance *').selectOption('Web')
    await page.getByRole('button', { name: 'Crear ítem' }).click()
    await expect(toast(page, 'BL-026 guardado en la base de datos.')).toBeVisible()
  }

  test('crear un ítem lo envía enseguida a ClickUp y queda vinculado con enlace', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend, { habilitado: true, conDestino: true })
    await crearItem(page)
    await expect
      .poll(() => backend.estado.clickup_cola.map((c) => [c.item_id, c.accion, c.estado]))
      .toEqual([[26, 'create', 'Enviada']])

    await irAMenu(page, 'Configuración & Datos')
    await page.getByRole('tab', { name: 'ClickUp' }).click()
    const actividad = tarjeta(page, 'Actividad').last()
    await expect(actividad).toContainText('BL-026 · Crear')
    await expect(actividad).toContainText('Enviada')
    await expect(kpi(page, 'Pendientes')).toContainText('0')

    await irAMenu(page, 'Backlog · Plan de Trabajo')
    await expect(fila(page, 'BL-026').getByLabel('Vinculado a ClickUp')).toBeVisible()
    await fila(page, 'BL-026').click()
    await expect(page.getByRole('link', { name: 'Abrir en ClickUp' })).toHaveAttribute('href', 'https://app.clickup.com/t/tarea-26')
  })

  test('editar un ítem vinculado envía la actualización enseguida', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend, { habilitado: true, conDestino: true })
    Object.assign(backend.estado.item.find((i) => i.codigo === 'BL-009'), {
      clickup_task_id: 'tarea-9',
      clickup_url: 'https://app.clickup.com/t/tarea-9',
    })
    await abrir(page, '/backlog')
    await fila(page, 'BL-009').click()
    await expect(page.getByRole('link', { name: 'Abrir en ClickUp' })).toBeVisible()
    await page.getByLabel('Descripción / alcance detallado').fill('Cambio de alcance')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect.poll(() => backend.estado.clickup_cola.map((c) => [c.accion, c.estado])).toEqual([['update', 'Enviada']])
    await expect(page.getByText('Sincronización pendiente')).toHaveCount(0)
  })

  test('eliminar un ítem encola su archivado en ClickUp', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend, { habilitado: true })
    await abrir(page, '/backlog')
    await fila(page, 'BL-024').click()
    await page.getByRole('button', { name: 'Eliminar ítem' }).click()
    await page.getByRole('button', { name: 'Sí, eliminar' }).click()
    await expect(fila(page, 'BL-024')).toHaveCount(0)
    expect(backend.estado.clickup_cola.map((c) => [c.item_id, c.accion])).toEqual([[24, 'archive']])
  })

  test('con la sincronización apagada no se encola nada', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    await crearItem(page)
    expect(backend.estado.clickup_cola).toEqual([])
  })

  test('un ítem sin vincular no muestra el panel de ClickUp', async ({ paginaAutenticada: page }) => {
    await abrir(page, '/backlog')
    await fila(page, 'BL-009').click()
    await expect(page.getByRole('heading', { level: 5, name: 'Editar BL-009' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 5, name: 'ClickUp', exact: true })).toHaveCount(0)
  })
})

test.describe('ClickUp · importar tareas existentes', () => {
  test('trae las tareas de una lista y aparecen en el backlog vinculadas', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend, { habilitado: true })
    await abrirClickUp(page)
    const bloque = page.locator('div.space-y-3', { hasText: 'Importar tareas existentes' }).last()
    await expect(bloque.getByRole('button', { name: 'Importar tareas' })).toBeDisabled()
    await bloque.getByLabel('Lista de ClickUp').selectOption({ label: 'Innovación y Desarrollo OTC / Plan de Trabajo / AIR-E' })
    await bloque.getByLabel('Cliente de los ítems').selectOption({ label: 'AIR-E' })
    await bloque.getByRole('button', { name: 'Importar tareas' }).click()
    await expect(toast(page, '2 tarea(s) importada(s) desde ClickUp.')).toBeVisible()

    await irAMenu(page, 'Backlog · Plan de Trabajo')
    await expect(fila(page, 'Tarea existente A').getByLabel('Vinculado a ClickUp')).toBeVisible()
    await expect(fila(page, 'Tarea existente B')).toContainText('AIR-E')
  })
})
