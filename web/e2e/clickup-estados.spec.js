import { abrir, expect, tarjeta, test, toast } from './support/fixtures.js'

const MAPEO = {
  'No iniciado': 'PENDIENTE',
  'En curso': 'EN DESARROLLO',
  'Terminado, en etapa de pruebas': 'VALIDACIÓN',
  Terminado: 'ENTREGADO',
  Suspendido: 'CERRADO',
}
const EQUIPO = { id: 't1', nombre: 'Ises' }

const fila = (page, codigo) => page.getByRole('row').filter({ hasText: codigo })

function conectar(backend, { mapeo = MAPEO, habilitado = true } = {}) {
  Object.assign(backend.estado.clickup, { token: 'pk_guardado', equipo: EQUIPO, habilitado, mapeo_estados: mapeo })
}

async function abrirClickUp(page) {
  await abrir(page, '/configuracion')
  await page.getByRole('tab', { name: 'ClickUp' }).click()
  await expect(page.getByRole('heading', { level: 5, name: 'Estados' })).toBeVisible()
}

async function marcarEstado(contenedor, estadoApp, estadoClickUp) {
  await contenedor.getByRole('button', { name: estadoApp, exact: true }).click()
  await contenedor.getByRole('checkbox', { name: estadoClickUp, exact: true }).check()
  await contenedor.page().keyboard.press('Escape')
}

test.describe('ClickUp · varios estados por estado de la app', () => {
  test('mapea varios estados de ClickUp a uno y marca el primero como el que se envía', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    await abrirClickUp(page)
    const estados = tarjeta(page, 'Estados').last()
    await marcarEstado(estados, 'Terminado', 'LISTO PARA ENTREGAR')

    await expect(estados.getByRole('button', { name: 'Terminado', exact: true })).toContainText('ENTREGADO, LISTO PARA ENTREGAR')
    await expect(estados.getByText('También se aceptan al leer:')).toBeVisible()
    await expect(estados.getByText('Se envía a ClickUp', { exact: true })).toHaveCount(5)

    await estados.getByRole('button', { name: 'Guardar mapeo' }).click()
    await expect(toast(page, 'Mapeo de estados guardado.')).toBeVisible()
    expect(backend.estado.clickup.mapeo_estados).toEqual({ ...MAPEO, Terminado: ['ENTREGADO', 'LISTO PARA ENTREGAR'] })
  })

  test('Hacer principal cambia el estado que se envía y el orden que se guarda', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend, { mapeo: { ...MAPEO, Terminado: ['ENTREGADO', 'LISTO PARA ENTREGAR'] } })
    await abrirClickUp(page)
    const estados = tarjeta(page, 'Estados').last()
    await estados.getByRole('button', { name: 'Hacer principal el estado LISTO PARA ENTREGAR de Terminado' }).click()
    await expect(estados.getByRole('button', { name: 'Terminado', exact: true })).toContainText('LISTO PARA ENTREGAR, ENTREGADO')

    await estados.getByRole('button', { name: 'Guardar mapeo' }).click()
    await expect(toast(page, 'Mapeo de estados guardado.')).toBeVisible()
    expect(backend.estado.clickup.mapeo_estados.Terminado).toEqual(['LISTO PARA ENTREGAR', 'ENTREGADO'])
  })

  test('al dejar un solo estado se guarda como texto, como antes', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend, { mapeo: { ...MAPEO, Terminado: ['ENTREGADO', 'LISTO PARA ENTREGAR'] } })
    await abrirClickUp(page)
    const estados = tarjeta(page, 'Estados').last()
    await estados.getByRole('button', { name: 'Terminado', exact: true }).click()
    await estados.getByRole('checkbox', { name: 'LISTO PARA ENTREGAR', exact: true }).uncheck()
    await page.keyboard.press('Escape')
    await estados.getByRole('button', { name: 'Guardar mapeo' }).click()
    await expect(toast(page, 'Mapeo de estados guardado.')).toBeVisible()
    expect(backend.estado.clickup.mapeo_estados.Terminado).toBe('ENTREGADO')
  })

  test('un tablero guarda su propio mapeo con varios estados sin tocar el general', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    backend.estado.clickup_tablero.push({ id: 1, nombre: 'Analítica', mapeo_estados: null })
    await abrirClickUp(page)
    const estados = tarjeta(page, 'Estados').last()
    await estados.getByRole('button', { name: 'Analítica', exact: true }).click()
    await marcarEstado(estados, 'Terminado', 'LISTO PARA ENTREGAR')
    await estados.getByRole('button', { name: 'Guardar mapeo' }).click()
    await expect(toast(page, 'Mapeo del tablero Analítica guardado.')).toBeVisible()
    expect(backend.estado.clickup_tablero[0].mapeo_estados).toEqual({ ...MAPEO, Terminado: ['ENTREGADO', 'LISTO PARA ENTREGAR'] })
    expect(backend.estado.clickup.mapeo_estados).toEqual(MAPEO)
  })
})

test.describe('ClickUp · reconciliar a la fuerza', () => {
  const MAPEO_VARIOS = { ...MAPEO, Terminado: ['ENTREGADO', 'LISTO PARA ENTREGAR'] }

  function vincular(backend, codigo, estadoRemoto) {
    const item = backend.estado.item.find((candidato) => candidato.codigo === codigo)
    Object.assign(item, { clickup_task_id: `tarea-${codigo}`, clickup_url: `https://app.clickup.com/t/tarea-${codigo}`, estado: 'No iniciado' })
    backend.estado.clickup.estados_remotos[item.clickup_task_id] = estadoRemoto
  }

  async function abrirSincronizacion(page) {
    await abrir(page, '/configuracion')
    await page.getByRole('tab', { name: 'ClickUp' }).click()
    await expect(page.getByRole('heading', { level: 5, name: 'Webhook y estado' })).toBeVisible()
  }

  test('pide confirmación y Cancelar no cambia nada', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend, { mapeo: MAPEO_VARIOS })
    vincular(backend, 'BL-009', 'LISTO PARA ENTREGAR')
    await abrirSincronizacion(page)
    await page.getByRole('button', { name: 'Reconciliar a la fuerza' }).click()
    const dialogo = page.getByRole('dialog', { name: 'Reconciliar a la fuerza' })
    await expect(dialogo).toContainText('Se pisarán los cambios que hayas hecho en la app desde que se importaron')
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused()
    await dialogo.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialogo).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Reconciliar a la fuerza' })).toBeFocused()
    expect(backend.estado.item.find((i) => i.codigo === 'BL-009').estado).toBe('No iniciado')
  })

  test('se puede cerrar con Escape sin reconciliar', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend, { mapeo: MAPEO_VARIOS })
    vincular(backend, 'BL-009', 'LISTO PARA ENTREGAR')
    await abrirSincronizacion(page)
    await page.getByRole('button', { name: 'Reconciliar a la fuerza' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(backend.estado.item.find((i) => i.codigo === 'BL-009').estado).toBe('No iniciado')
  })

  test('confirmar actualiza los ítems según cualquiera de los estados mapeados y informa el resumen', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend, { mapeo: MAPEO_VARIOS })
    vincular(backend, 'BL-009', 'LISTO PARA ENTREGAR')
    vincular(backend, 'BL-001', 'EN DESARROLLO')
    await abrirSincronizacion(page)
    await page.getByRole('button', { name: 'Reconciliar a la fuerza' }).click()
    await page.getByRole('button', { name: 'Sí, reconciliar a la fuerza' }).click()
    await expect(toast(page, 'Reconciliación forzada: 0 creada(s), 2 actualizada(s), 0 archivada(s).')).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(backend.estado.item.find((i) => i.codigo === 'BL-009').estado).toBe('Terminado')
    expect(backend.estado.item.find((i) => i.codigo === 'BL-001').estado).toBe('En curso')

    await abrir(page, '/backlog')
    await expect(fila(page, 'BL-009')).toContainText('Terminado')
  })

  test('no toca ítems con un cambio pendiente de enviar', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend, { mapeo: MAPEO_VARIOS })
    vincular(backend, 'BL-009', 'LISTO PARA ENTREGAR')
    const item = backend.estado.item.find((i) => i.codigo === 'BL-009')
    backend.estado.clickup_cola.push({
      id: 1, item_id: item.id, accion: 'update', estado: 'Pendiente', intentos: 0, error: null, creado_en: new Date().toISOString(), procesado_en: null,
    })
    await abrirSincronizacion(page)
    await page.getByRole('button', { name: 'Reconciliar a la fuerza' }).click()
    await page.getByRole('button', { name: 'Sí, reconciliar a la fuerza' }).click()
    await expect(toast(page, 'Reconciliación forzada: 0 creada(s), 0 actualizada(s), 0 archivada(s).')).toBeVisible()
    expect(item.estado).toBe('No iniciado')
  })

  test('queda deshabilitado con la sincronización apagada', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend, { habilitado: false })
    await abrirSincronizacion(page)
    await expect(page.getByRole('button', { name: 'Reconciliar a la fuerza' })).toBeDisabled()
  })
})
