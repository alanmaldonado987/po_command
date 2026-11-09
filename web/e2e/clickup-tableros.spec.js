import { ESPERADO } from './support/datosSemilla.js'
import { abrir, expect, kpi, tarjeta, test, toast } from './support/fixtures.js'

const MAPEO = {
  'No iniciado': 'PENDIENTE',
  'En curso': 'EN DESARROLLO',
  'Terminado, en etapa de pruebas': 'VALIDACIÓN',
  Terminado: 'ENTREGADO',
  Suspendido: 'CERRADO',
}
const EQUIPO = { id: 't1', nombre: 'Ises' }
const RUTA_BACKLOG_DEV = 'Innovación y Desarrollo OTC / Backlog Dev'

const DESARROLLO = { id: 1, nombre: 'Desarrollo', mapeo_estados: null }
const ANALITICA = { id: 2, nombre: 'Analítica', mapeo_estados: null }
const LUIS = 'Luis Kendor Narváez'
const DAIRO = 'Dairo Pérez'

const fila = (page, codigo) => page.getByRole('row').filter({ hasText: codigo })
const ficha = (page, nombre) => page.locator('article', { hasText: nombre })
const bloqueDestino = (page, titulo) => page.getByText(titulo, { exact: true }).locator('xpath=ancestor::div[contains(@class,"space-y-3")][1]')
const campoSelect = (contenedor, etiqueta) =>
  contenedor.locator('label', { has: contenedor.page().locator('span.field-label', { hasText: new RegExp(`^${etiqueta}$`) }) }).locator('select')
const irAMenu = (page, nombre) => page.locator('aside').getByRole('link', { name: nombre, exact: true }).click()

function conectar(backend, { habilitado = true } = {}) {
  Object.assign(backend.estado.clickup, { token: 'pk_guardado', equipo: EQUIPO, habilitado, mapeo_estados: MAPEO })
}

function conTableros(backend, { asignar = true } = {}) {
  backend.estado.clickup_tablero.push({ ...DESARROLLO }, { ...ANALITICA })
  if (!asignar) return
  backend.estado.persona.find((p) => p.nombre === DAIRO).tablero_id = DESARROLLO.id
  backend.estado.persona.find((p) => p.nombre === LUIS).tablero_id = ANALITICA.id
}

function destino(backend, { id, tableroId = null, clienteId = null, listaId = 'l9', listaNombre = RUTA_BACKLOG_DEV }) {
  backend.estado.clickup_destino.push({ id, tablero_id: tableroId, cliente_id: clienteId, lista_id: listaId, lista_nombre: listaNombre })
}

async function abrirClickUp(page) {
  await abrir(page, '/configuracion')
  await page.getByRole('tab', { name: 'ClickUp' }).click()
  await expect(page.getByRole('heading', { level: 5, name: 'Tableros' })).toBeVisible()
}

async function elegirLista(page, titulo, { carpeta, lista }) {
  await page.getByLabel(`Espacio de ${titulo}`).selectOption({ label: 'Innovación y Desarrollo OTC' })
  await page.getByLabel(`Carpeta de ${titulo}`).selectOption({ label: carpeta })
  await page.getByLabel(`Lista de ${titulo}`).selectOption({ label: lista })
}

async function guardarDestino(page, titulo, seleccion) {
  await elegirLista(page, titulo, seleccion)
  await page.getByRole('button', { name: `Guardar destino de ${titulo}` }).click()
  await expect(toast(page, `Destino de ${titulo} guardado.`)).toBeVisible()
}

async function cambiarTableroDe(page, nombre, tablero) {
  await ficha(page, nombre).getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Tablero de ClickUp').selectOption({ label: tablero })
}

test.describe('ClickUp · tableros', () => {
  test('crea dos tableros y los lista con su uso', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    await abrirClickUp(page)
    await expect(page.getByText(/Aún no hay tableros/)).toBeVisible()
    const agregar = page.getByRole('button', { name: 'Agregar tablero' })
    await expect(agregar).toBeDisabled()

    for (const nombre of ['Desarrollo', 'Analítica']) {
      await page.getByLabel('Nuevo tablero').fill(nombre)
      await agregar.click()
      await expect(toast(page, `Tablero «${nombre}» creado.`)).toBeVisible()
    }
    await expect(page.getByLabel('Nombre del tablero Desarrollo')).toBeVisible()
    await expect(page.getByLabel('Nombre del tablero Analítica')).toBeVisible()
    await expect(page.getByText('0 persona(s)')).toHaveCount(2)
    await expect(page.getByText('Usa el mapeo general')).toHaveCount(2)
    expect(backend.estado.clickup_tablero.map((t) => t.nombre)).toEqual(['Desarrollo', 'Analítica'])
  })

  test('un nombre repetido se rechaza con un aviso', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    conTableros(backend, { asignar: false })
    await abrirClickUp(page)
    await page.getByLabel('Nuevo tablero').fill('Desarrollo')
    await page.getByRole('button', { name: 'Agregar tablero' }).click()
    await expect(toast(page, /duplicate key value/)).toBeVisible()
    expect(backend.estado.clickup_tablero).toHaveLength(2)
  })

  test('renombrar un tablero actualiza su nombre', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    conTableros(backend, { asignar: false })
    await abrirClickUp(page)
    const renombrar = page.getByRole('button', { name: 'Renombrar tablero Desarrollo' })
    await expect(renombrar).toBeDisabled()
    await page.getByLabel('Nombre del tablero Desarrollo').fill('Ingeniería')
    await renombrar.click()
    await expect(toast(page, 'Tablero renombrado a «Ingeniería».')).toBeVisible()
    expect(backend.estado.clickup_tablero.map((t) => t.nombre)).toEqual(['Ingeniería', 'Analítica'])
  })

  test('eliminar un tablero pide confirmación con su uso y se puede cancelar', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    conTableros(backend)
    destino(backend, { id: 1, tableroId: DESARROLLO.id })
    await abrirClickUp(page)
    await page.getByRole('button', { name: 'Eliminar tablero Desarrollo' }).click()
    await expect(page.getByText(/¿Eliminar el tablero «Desarrollo»\? Lo usan 1 persona\(s\) y 1 destino\(s\)/)).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await expect(page.getByText(/¿Eliminar el tablero/)).toHaveCount(0)
    expect(backend.estado.clickup_tablero).toHaveLength(2)
  })

  test('confirmar la eliminación libera a las personas y borra los destinos del tablero', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    conTableros(backend)
    destino(backend, { id: 1, tableroId: DESARROLLO.id })
    destino(backend, { id: 2 })
    await abrirClickUp(page)
    await page.getByRole('button', { name: 'Eliminar tablero Desarrollo' }).click()
    await page.getByRole('button', { name: 'Sí, eliminar' }).click()
    await expect(toast(page, 'Tablero «Desarrollo» eliminado.')).toBeVisible()
    await expect(page.getByLabel('Nombre del tablero Desarrollo')).toHaveCount(0)
    expect(backend.estado.persona.find((p) => p.nombre === DAIRO).tablero_id).toBeNull()
    expect(backend.estado.clickup_destino.map((d) => d.id)).toEqual([2])
  })
})

test.describe('ClickUp · personas y tableros', () => {
  test('asigna personas a un tablero desde Equipo y la ficha lo muestra', async ({ paginaAutenticada: page, backend }) => {
    conTableros(backend, { asignar: false })
    await abrir(page, '/equipo')
    await cambiarTableroDe(page, DAIRO, 'Desarrollo')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(toast(page, `${DAIRO} actualizado.`)).toBeVisible()
    await expect(ficha(page, DAIRO).getByText('Desarrollo')).toBeVisible()

    await cambiarTableroDe(page, LUIS, 'Analítica')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(ficha(page, LUIS).getByText('Analítica')).toBeVisible()
    expect(backend.estado.persona.filter((p) => p.tablero_id).map((p) => [p.nombre, p.tablero_id])).toEqual([[LUIS, 2], [DAIRO, 1]])

    await irAMenu(page, 'Configuración & Datos')
    await page.getByRole('tab', { name: 'ClickUp' }).click()
    await expect(page.getByText('1 persona(s)')).toHaveCount(2)
  })

  test('el stakeholder no tiene tablero y buscar encuentra por tablero', async ({ paginaAutenticada: page, backend }) => {
    conTableros(backend)
    await abrir(page, '/equipo')
    await page.getByLabel(/Buscar/).fill('analítica')
    await expect(ficha(page, LUIS)).toBeVisible()
    await expect(ficha(page, DAIRO)).toHaveCount(0)

    await page.getByRole('button', { name: 'Stakeholders' }).click()
    await page.getByLabel(/Buscar/).fill('')
    await ficha(page, 'Carlos Gómez').getByRole('button', { name: 'Editar' }).click()
    await expect(page.getByLabel('Tablero de ClickUp')).toHaveCount(0)
  })

  test('cambiar el tablero de una persona avisa que moverá sus ítems abiertos', async ({ paginaAutenticada: page, backend }) => {
    conTableros(backend)
    await abrir(page, '/equipo')
    await ficha(page, DAIRO).getByRole('button', { name: 'Editar' }).click()
    await expect(page.getByText(/se moverán a la lista del nuevo tablero/)).toHaveCount(0)
    await page.getByLabel('Tablero de ClickUp').selectOption({ label: 'Analítica' })
    await expect(page.getByText(/ítem\(s\) abiertos de Dairo Pérez se moverán a la lista del nuevo tablero en ClickUp/)).toBeVisible()
  })
})

test.describe('ClickUp · destinos por tablero', () => {
  test.beforeEach(async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    conTableros(backend)
    await abrirClickUp(page)
  })

  test('muestra una sección por tablero con una fila por cliente', async ({ paginaAutenticada: page }) => {
    await expect(page.getByText('Sin tablero / por defecto')).toBeVisible()
    await expect(page.getByText('Tablero Desarrollo')).toBeVisible()
    await expect(page.getByText('Tablero Analítica')).toBeVisible()
    for (const titulo of ['Desarrollo · Todos los clientes', 'Desarrollo · AIR-E', 'Analítica · ELECTROHUILA']) {
      await expect(page.getByText(titulo, { exact: true })).toBeVisible()
    }
  })

  test('configura destinos por tablero y cliente y muestra de dónde hereda cada fila', async ({ paginaAutenticada: page, backend }) => {
    await guardarDestino(page, 'Destino por defecto', { carpeta: 'Sin carpeta', lista: 'Backlog Dev' })
    await expect(bloqueDestino(page, 'Desarrollo · ELECTROHUILA').getByText('Usa el destino por defecto')).toBeVisible()

    await guardarDestino(page, 'Desarrollo · AIR-E', { carpeta: 'Plan de Trabajo', lista: 'AIR-E' })
    await expect(bloqueDestino(page, 'Desarrollo · AIR-E').getByText(/Lista actual: .*AIR-E/)).toBeVisible()

    await guardarDestino(page, 'Analítica · Todos los clientes', { carpeta: 'Plan de Trabajo', lista: 'ELECTROHUILA' })
    await expect(bloqueDestino(page, 'Analítica · AIR-E').getByText('Usa el destino del tablero')).toBeVisible()
    await expect(bloqueDestino(page, 'Analítica · AIR-E').getByText(/Se enviará a: .*ELECTROHUILA/)).toBeVisible()
    await expect(bloqueDestino(page, 'Desarrollo · ELECTROHUILA').getByText('Usa el destino por defecto')).toBeVisible()

    expect(backend.estado.clickup_destino.map((d) => [d.tablero_id, d.cliente_id, d.lista_id])).toEqual([
      [null, null, 'l9'],
      [1, 1, 'l1'],
      [2, null, 'l2'],
    ])
  })

  test('sin ningún destino las filas avisan «Sin destino» y quitar un destino lo elimina', async ({ paginaAutenticada: page, backend }) => {
    await expect(bloqueDestino(page, 'Desarrollo · AIR-E').getByText('Sin destino', { exact: true })).toBeVisible()
    await guardarDestino(page, 'Desarrollo · AIR-E', { carpeta: 'Plan de Trabajo', lista: 'AIR-E' })
    await page.getByRole('button', { name: 'Quitar destino de Desarrollo · AIR-E' }).click()
    await expect(toast(page, 'Destino de Desarrollo · AIR-E quitado.')).toBeVisible()
    await expect(bloqueDestino(page, 'Desarrollo · AIR-E').getByText('Sin destino', { exact: true })).toBeVisible()
    expect(backend.estado.clickup_destino).toEqual([])
  })

  test('avisa de los ítems abiertos sin destino y el aviso desaparece al configurar uno por defecto', async ({ paginaAutenticada: page }) => {
    const aviso = page.getByText(/ítem\(s\) abiertos no tienen destino en ClickUp y no se enviarán/)
    await expect(aviso).toContainText(`${ESPERADO.abiertos} ítem(s)`)
    await expect(page.getByRole('link', { name: 'Corregir destinos' })).toHaveAttribute('href', '#destinos-clickup')

    await guardarDestino(page, 'Destino por defecto', { carpeta: 'Sin carpeta', lista: 'Backlog Dev' })
    await expect(aviso).toHaveCount(0)
  })
})

test.describe('ClickUp · estados por tablero', () => {
  test.beforeEach(async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    conTableros(backend)
    await abrirClickUp(page)
  })

  test('cada tablero puede tener su propio mapeo y volver al general', async ({ paginaAutenticada: page, backend }) => {
    const estados = tarjeta(page, 'Estados').last()
    await estados.getByRole('button', { name: 'Desarrollo', exact: true }).click()
    await expect(estados.getByText(/Este tablero usa el mapeo general/)).toBeVisible()
    await expect(estados.getByRole('button', { name: 'Usar el mapeo general' })).toHaveCount(0)

    await campoSelect(estados, 'Terminado').selectOption({ label: 'CERRADO' })
    await estados.getByRole('button', { name: 'Guardar mapeo' }).click()
    await expect(toast(page, 'Mapeo del tablero Desarrollo guardado.')).toBeVisible()
    expect(backend.estado.clickup_tablero[0].mapeo_estados).toEqual({ ...MAPEO, Terminado: 'CERRADO' })
    expect(backend.estado.clickup.mapeo_estados).toEqual(MAPEO)
    await expect(page.getByText('Mapeo de estados propio')).toBeVisible()

    await estados.getByRole('button', { name: 'Usar el mapeo general' }).click()
    await expect(toast(page, 'El tablero Desarrollo usa ahora el mapeo general.')).toBeVisible()
    expect(backend.estado.clickup_tablero[0].mapeo_estados).toBeNull()
    await expect(page.getByText('Mapeo de estados propio')).toHaveCount(0)
  })

  test('el mapeo general sigue editándose desde la pestaña General', async ({ paginaAutenticada: page, backend }) => {
    const estados = tarjeta(page, 'Estados').last()
    await estados.getByRole('button', { name: 'Analítica', exact: true }).click()
    await estados.getByRole('button', { name: 'General', exact: true }).click()
    await expect(campoSelect(estados, 'Terminado')).toHaveValue('ENTREGADO')
    await estados.getByRole('button', { name: 'Guardar mapeo' }).click()
    await expect(toast(page, 'Mapeo de estados guardado.')).toBeVisible()
    expect(backend.estado.clickup.mapeo_estados).toEqual(MAPEO)
  })
})

test.describe('ClickUp · ítems con tablero', () => {
  function vincular(backend, codigo) {
    Object.assign(backend.estado.item.find((i) => i.codigo === codigo), {
      clickup_task_id: `tarea-${codigo}`,
      clickup_url: `https://app.clickup.com/t/tarea-${codigo}`,
    })
  }

  test('el backlog muestra el tablero del responsable en la tabla y en el panel', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    conTableros(backend)
    destino(backend, { id: 1 })
    vincular(backend, 'BL-009')
    await abrir(page, '/backlog')
    await expect(fila(page, 'BL-009').locator('span.bg-violet-soft')).toHaveText('Desarrollo')
    await fila(page, 'BL-009').click()
    const panel = tarjeta(page, 'ClickUp')
    await expect(panel.getByText('Desarrollo', { exact: true })).toBeVisible()
    await expect(panel.getByRole('link', { name: 'Abrir en ClickUp' })).toBeVisible()
  })

  test('avisa cuando el tablero del responsable no tiene destino', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    conTableros(backend)
    await abrir(page, '/backlog')
    await fila(page, 'BL-009').click()
    await expect(page.getByText('Sin destino en ClickUp para Desarrollo / AIR-E')).toBeVisible()
  })

  test('cambiar el responsable a una persona de otro tablero encola «mover»', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    conTableros(backend)
    destino(backend, { id: 1 })
    vincular(backend, 'BL-009')
    await abrir(page, '/backlog')
    await fila(page, 'BL-009').click()
    await page.getByRole('combobox', { name: 'Responsable' }).selectOption({ label: LUIS })
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect.poll(() => backend.estado.clickup_cola.map((c) => [c.item_id, c.accion])).toEqual([[9, 'update'], [9, 'mover']])
  })

  test('cambiar el tablero de una persona mueve sus ítems abiertos vinculados', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    conTableros(backend)
    destino(backend, { id: 1 })
    vincular(backend, 'BL-009')
    vincular(backend, 'BL-001')
    await abrir(page, '/equipo')
    await cambiarTableroDe(page, DAIRO, 'Analítica')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(toast(page, `${DAIRO} actualizado.`)).toBeVisible()
    const moverIds = backend.estado.clickup_cola.filter((c) => c.accion === 'mover').map((c) => c.item_id)
    expect(moverIds).toContain(9)
    expect(moverIds).not.toContain(1)
  })

  test('sin destino, sincronizar deja el envío fallido con el motivo visible', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    conTableros(backend)
    vincular(backend, 'BL-009')
    backend.estado.clickup_cola.push({
      id: 1, item_id: 9, accion: 'update', estado: 'Pendiente', intentos: 0, error: null, creado_en: new Date().toISOString(), procesado_en: null,
    })
    await abrirClickUp(page)
    await page.getByRole('button', { name: 'Sincronizar ahora' }).click()
    await expect(toast(page, '0 cambio(s) procesado(s), 1 con error.')).toBeVisible()
    const actividad = tarjeta(page, 'Actividad').last()
    await expect(actividad).toContainText('Fallida')
    await expect(actividad).toContainText('Sin destino configurado')
    await expect(kpi(page, 'Con error')).toContainText('1')
  })

  test('la actividad muestra la acción «Mover»', async ({ paginaAutenticada: page, backend }) => {
    conectar(backend)
    conTableros(backend)
    destino(backend, { id: 1 })
    vincular(backend, 'BL-009')
    backend.estado.clickup_cola.push({
      id: 1, item_id: 9, accion: 'mover', estado: 'Enviada', intentos: 1, error: null, creado_en: new Date().toISOString(), procesado_en: new Date().toISOString(),
    })
    await abrirClickUp(page)
    await expect(tarjeta(page, 'Actividad').last()).toContainText('BL-009 · Mover')
  })
})
