import fs from 'node:fs'
import * as XLSX from 'xlsx'
import { ESPERADO } from './support/datosSemilla.js'
import { abrir, elegirOpciones, expect, tarjeta, test, toast } from './support/fixtures.js'
import { enDias, hoyIso } from './support/tiempo.js'

const filasDatos = (page) => page.getByRole('row').filter({ has: page.getByRole('cell') })
const fila = (page, codigo) => page.getByRole('row').filter({ hasText: codigo })
const itemsActivos = (backend) => backend.estado.item.filter((i) => !i.eliminado_en)

async function abrirItem(page, codigo) {
  await fila(page, codigo).click()
  await expect(page.getByRole('heading', { level: 5, name: `Editar ${codigo}` })).toBeVisible()
}

test.describe('Backlog · tabla y filtros', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/backlog')
    await expect(filasDatos(page).first()).toBeVisible()
  })

  test('el encabezado de la tabla cuenta ítems, abiertos y atrasados', async ({ paginaAutenticada: page }) => {
    await expect(
      page.getByRole('heading', { level: 5, name: `${ESPERADO.items} ítems · ${ESPERADO.abiertos} abiertos · ${ESPERADO.atrasados} atrasados` }),
    ).toBeVisible()
    await expect(filasDatos(page)).toHaveCount(ESPERADO.items)
  })

  test('muestra el chip «Bloqueado» y los días de atraso en la tabla', async ({ paginaAutenticada: page }) => {
    await expect(fila(page, 'BL-024')).toContainText('Bloqueado')
    await expect(fila(page, 'BL-009')).toContainText(/\d+/)
    await expect(fila(page, 'BL-001')).toContainText('Terminado')
  })

  test('filtra por cliente', async ({ paginaAutenticada: page, backend }) => {
    await elegirOpciones(page, 'Cliente', ['AIR-E'])
    await expect(filasDatos(page)).toHaveCount(itemsActivos(backend).filter((i) => i.cliente_id === 1).length)
  })

  test('combina cliente y estado «Atrasado»', async ({ paginaAutenticada: page }) => {
    await elegirOpciones(page, 'Cliente', ['ELECTROHUILA'])
    await elegirOpciones(page, 'Estado', ['Atrasado'])
    await expect(filasDatos(page)).toHaveCount(2)
    await expect(fila(page, 'BL-011')).toBeVisible()
    await expect(fila(page, 'BL-012')).toBeVisible()
  })

  test('el estado «Bloqueado» muestra solo los bloqueados', async ({ paginaAutenticada: page }) => {
    await elegirOpciones(page, 'Estado', ['Bloqueado'])
    await expect(filasDatos(page)).toHaveCount(ESPERADO.bloqueantes)
  })

  test('busca por texto dentro de la bitácora', async ({ paginaAutenticada: page }) => {
    await page.getByLabel('Buscar').fill('certificado SSL')
    await expect(filasDatos(page)).toHaveCount(1)
    await expect(fila(page, 'BL-010')).toBeVisible()
  })

  test('busca por código', async ({ paginaAutenticada: page }) => {
    await page.getByLabel('Buscar').fill('BL-024')
    await expect(filasDatos(page)).toHaveCount(1)
    await expect(fila(page, 'BL-024')).toContainText('Control de acceso')
  })

  test('sin coincidencias muestra el estado vacío', async ({ paginaAutenticada: page }) => {
    await page.getByLabel('Buscar').fill('zzz-no-existe')
    await expect(page.getByText('No hay ítems que coincidan con el filtro.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Descargar en formato Plan de Trabajo' })).toBeDisabled()
  })

  test('«Más filtros» filtra por alcance', async ({ paginaAutenticada: page }) => {
    await page.getByText('Más filtros').click()
    await elegirOpciones(page, 'Alcance', ['APK'])
    await expect(filasDatos(page)).toHaveCount(1)
    await expect(fila(page, 'BL-019')).toBeVisible()
  })

  test('filtra por responsable y módulo', async ({ paginaAutenticada: page, backend }) => {
    await page.getByText('Más filtros').click()
    await elegirOpciones(page, 'Responsable', ['Luis Kendor Narváez'])
    await elegirOpciones(page, 'Módulo / componente', ['Órdenes'])
    const esperadas = itemsActivos(backend).filter((i) => i.responsable_id === 1 && i.modulo_id === 2).length
    await expect(filasDatos(page)).toHaveCount(esperadas)
  })

  test('descarga el Plan de Trabajo con una hoja por cliente', async ({ paginaAutenticada: page, backend }) => {
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar en formato Plan de Trabajo' }).click(),
    ])
    expect(descarga.suggestedFilename()).toBe(`Plan_de_Trabajo_${hoyIso().replaceAll('-', '')}.xlsx`)
    const libro = XLSX.read(fs.readFileSync(await descarga.path()))
    expect(libro.SheetNames.sort()).toEqual(['ACUACAR', 'AIR-E', 'ELECTROHUILA'])
    const filasAire = XLSX.utils.sheet_to_json(libro.Sheets['AIR-E'], { header: 1 })
    const esperadas = itemsActivos(backend).filter((i) => i.cliente_id === 1).length
    expect(filasAire.length - 3).toBe(esperadas)
    expect(filasAire[2][2]).toBe('Menú/Funcionalidad')
  })
})

test.describe('Backlog · editor', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/backlog')
    await expect(filasDatos(page).first()).toBeVisible()
  })

  test('seleccionar una fila abre el editor con bitácora y destinatarios', async ({ paginaAutenticada: page }) => {
    await abrirItem(page, 'BL-009')
    await expect(tarjeta(page, 'Bitácora')).toContainText('Cambio de fechas · fin planificado: 01/10/2026 → 25/10/2026')
    const destinatarios = tarjeta(page, 'Si se bloquea, se avisa a')
    await expect(destinatarios).toContainText('Dairo Pérez')
    await expect(destinatarios).toContainText('Verónica Rodríguez')
    await expect(destinatarios).toContainText('Carlos Gómez')
  })

  test('volver a pulsar la fila cierra el editor', async ({ paginaAutenticada: page }) => {
    await abrirItem(page, 'BL-009')
    await fila(page, 'BL-009').click()
    await expect(page.getByRole('heading', { level: 5, name: 'Editar BL-009' })).toHaveCount(0)
  })

  test('crea un ítem con un cliente nuevo escrito a mano', async ({ paginaAutenticada: page, backend }) => {
    await page.getByRole('button', { name: 'Nuevo ítem' }).click()
    await expect(page.getByRole('heading', { level: 5, name: 'Nuevo ítem del backlog' })).toBeVisible()
    await expect(tarjeta(page, 'Antes de crear')).toBeVisible()
    await page.getByLabel('Cliente *').fill('CLIENTE NUEVO')
    await page.getByLabel('Actividad *').fill('SCR')
    await page.getByLabel('Módulo / componente *').fill('Órdenes')
    await page.getByLabel('Menú / funcionalidad *').fill('Reporte de QA')
    await page.getByLabel('Alcance *').selectOption('Web')
    await page.getByRole('button', { name: 'Crear ítem' }).click()

    await expect(toast(page, 'BL-026 guardado en la base de datos.')).toBeVisible()
    await expect(page.getByRole('heading', { level: 5, name: 'Editar BL-026' })).toBeVisible()
    await expect(fila(page, 'BL-026')).toContainText('CLIENTE NUEVO')
    expect(backend.estado.cliente.map((c) => c.nombre)).toContain('CLIENTE NUEVO')
    expect(itemsActivos(backend)).toHaveLength(ESPERADO.items + 1)
  })

  test('valida los campos obligatorios', async ({ paginaAutenticada: page, backend }) => {
    await page.getByRole('button', { name: 'Nuevo ítem' }).click()
    await page.getByRole('button', { name: 'Crear ítem' }).click()
    await expect(page.getByText('Completa los campos con *: cliente, actividad, módulo, funcionalidad y alcance.')).toBeVisible()
    expect(backend.peticionesA('/rpc/guardar_item')).toHaveLength(0)
  })

  test('rechaza una fecha fin anterior al inicio', async ({ paginaAutenticada: page }) => {
    await abrirItem(page, 'BL-009')
    await page.getByLabel('Inicio desarrollo / customización', { exact: true }).fill(enDias(10))
    await page.getByLabel('Fin desarrollo / customización', { exact: true }).fill(enDias(2))
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('En desarrollo planificado la fecha fin es anterior a la de inicio.')).toBeVisible()
  })

  test('bloquear un ítem exige el motivo', async ({ paginaAutenticada: page }) => {
    await abrirItem(page, 'BL-018')
    await page.getByRole('switch', { name: 'Ítem bloqueado' }).click()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Indica el motivo del bloqueo: se incluye en el correo de alerta.')).toBeVisible()
  })

  test('bloquear con motivo crea el bloqueante y avisa a los destinatarios', async ({ paginaAutenticada: page, backend }) => {
    await abrirItem(page, 'BL-018')
    await page.getByRole('switch', { name: 'Ítem bloqueado' }).click()
    await page.getByLabel('Motivo del bloqueo').fill('Espera aprobación del cliente')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(toast(page, /Alerta de bloqueante para \d+ destinatario\(s\)\./)).toBeVisible()
    await expect(fila(page, 'BL-018')).toContainText('Bloqueado')
    const abierto = backend.estado.bloqueante.find((b) => b.item_id === 18 && !b.resuelto_en)
    expect(abierto.motivo).toBe('Espera aprobación del cliente')
    await expect(tarjeta(page, 'Bitácora')).toContainText('Bloqueado: Espera aprobación del cliente')
  })

  test('desbloquear resuelve el bloqueante y lo anota en la bitácora', async ({ paginaAutenticada: page, backend }) => {
    await abrirItem(page, 'BL-024')
    await page.getByRole('switch', { name: 'Ítem bloqueado' }).click()
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(toast(page, 'Bloqueo resuelto')).toBeVisible()
    await expect(tarjeta(page, 'Bitácora')).toContainText('Bloqueo resuelto: Falta acceso al servidor del cliente')
    expect(backend.estado.bloqueante.filter((b) => b.item_id === 24 && !b.resuelto_en)).toHaveLength(0)
  })

  test('cambiar una fecha planificada registra la reprogramación en la bitácora', async ({ paginaAutenticada: page, backend }) => {
    await abrirItem(page, 'BL-009')
    await page.getByLabel('Fin desarrollo / customización', { exact: true }).fill(enDias(20))
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(toast(page, 'Cambio de fechas registrado en la bitácora.')).toBeVisible()
    await expect(toast(page, /Reprogramación avisada a \d+ destinatario\(s\)\./)).toBeVisible()
    const bitacora = tarjeta(page, 'Bitácora')
    await expect(bitacora).toContainText('Reprogramación')
    await expect(bitacora).toContainText('Cambio de fechas · fin planificado:')
    expect(backend.estado.item.find((i) => i.id === 9).plan_fin).toBe(enDias(20))
  })

  test('guardar sin cambios no genera reprogramaciones', async ({ paginaAutenticada: page, backend }) => {
    await abrirItem(page, 'BL-009')
    const notasAntes = backend.estado.nota.length
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(toast(page, 'BL-009 guardado en la base de datos.')).toBeVisible()
    expect(backend.estado.nota.length).toBe(notasAntes)
  })

  test('agrega una nota a la bitácora al guardar', async ({ paginaAutenticada: page, backend }) => {
    await abrirItem(page, 'BL-009')
    await page.getByLabel('Nueva nota para la bitácora').fill('Se acordó una demo con el cliente')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(tarjeta(page, 'Bitácora')).toContainText('Se acordó una demo con el cliente')
    expect(backend.estado.nota.at(-1).autor).toBe('Verónica Rodríguez')
  })

  test('elimina una nota de la bitácora', async ({ paginaAutenticada: page, backend }) => {
    await abrirItem(page, 'BL-010')
    await tarjeta(page, 'Bitácora').getByRole('button', { name: 'Eliminar nota' }).first().click()
    await expect(tarjeta(page, 'Bitácora').getByText('Sin notas todavía.')).toBeVisible()
    expect(backend.estado.nota.filter((n) => n.item_id === 10)).toHaveLength(0)
  })

  test('duplicar abre un ítem nuevo con los datos del original', async ({ paginaAutenticada: page }) => {
    await abrirItem(page, 'BL-001')
    await page.getByRole('button', { name: 'Duplicar ítem' }).click()
    await expect(page.getByRole('heading', { level: 5, name: 'Nuevo ítem (copia de BL-001)' })).toBeVisible()
    await expect(page.getByLabel('Menú / funcionalidad *')).toHaveValue('Mapa de flota')
    await expect(page.getByLabel('Cliente *')).toHaveValue('AIR-E')
  })

  test('eliminar pide confirmación y cancela las alertas del ítem', async ({ paginaAutenticada: page, backend }) => {
    await abrirItem(page, 'BL-024')
    await page.getByRole('button', { name: 'Eliminar ítem' }).click()
    await expect(page.getByText('¿Eliminar BL-024? Se cancelarán sus alertas programadas.')).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await expect(fila(page, 'BL-024')).toBeVisible()

    await page.getByRole('button', { name: 'Eliminar ítem' }).click()
    await page.getByRole('button', { name: 'Sí, eliminar' }).click()
    await expect(toast(page, 'BL-024 eliminado; 1 alerta(s) programada(s) cancelada(s).')).toBeVisible()
    await expect(fila(page, 'BL-024')).toHaveCount(0)
    expect(itemsActivos(backend)).toHaveLength(ESPERADO.items - 1)
  })

  test('un error del servidor al guardar se muestra en el formulario', async ({ paginaAutenticada: page, backend }) => {
    backend.fallarConsulta('/rpc/guardar_item', { estado: 400, mensaje: 'La funcionalidad es obligatoria' })
    await abrirItem(page, 'BL-009')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('La funcionalidad es obligatoria')).toBeVisible()
  })

  test('el botón Cerrar oculta el editor', async ({ paginaAutenticada: page }) => {
    await abrirItem(page, 'BL-009')
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
    await expect(page.getByRole('heading', { level: 5, name: 'Editar BL-009' })).toHaveCount(0)
  })
})
