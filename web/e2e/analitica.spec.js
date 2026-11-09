import { ESPERADO } from './support/datosSemilla.js'
import { abrir, elegirOpciones, expect, kpi, tarjeta, test } from './support/fixtures.js'

const porcentaje = (parte, total) => ((parte / total) * 100).toFixed(0)

test.describe('Analítica', () => {
  test.beforeEach(async ({ paginaAutenticada: page }) => {
    await abrir(page, '/analitica')
    await expect(kpi(page, 'Avance')).toBeVisible()
  })

  test('calcula los KPIs globales desde los datos', async ({ paginaAutenticada: page }) => {
    await expect(kpi(page, 'Avance')).toContainText(`${porcentaje(ESPERADO.terminados, ESPERADO.items)}%`)
    await expect(kpi(page, 'Avance')).toContainText(`${ESPERADO.terminados} de ${ESPERADO.items} ítems terminados`)
    await expect(kpi(page, 'Entrega a tiempo')).toContainText('60%')
    await expect(kpi(page, 'Atrasados')).toContainText(String(ESPERADO.atrasados))
    await expect(kpi(page, 'Atrasados')).toContainText('días en promedio')
    await expect(kpi(page, 'Reprogramaciones')).toContainText('2')
    await expect(kpi(page, 'Resolución de bloqueos')).toContainText('48 h')
  })

  test('el filtro por cliente recalcula los KPIs', async ({ paginaAutenticada: page, backend }) => {
    const delCliente = backend.estado.item.filter((i) => i.cliente_id === 2)
    const terminados = delCliente.filter((i) => i.estado === 'Terminado').length
    await elegirOpciones(page, 'Cliente', ['ELECTROHUILA'])
    await expect(kpi(page, 'Avance')).toContainText(`${terminados} de ${delCliente.length} ítems terminados`)
    await expect(kpi(page, 'Avance')).toContainText(`${porcentaje(terminados, delCliente.length)}%`)
  })

  test('una combinación sin ítems muestra el estado vacío', async ({ paginaAutenticada: page }) => {
    await elegirOpciones(page, 'Cliente', ['ACUACAR'])
    await elegirOpciones(page, 'Alcance', ['APK'])
    await expect(page.getByText('Ningún ítem coincide con el filtro.')).toBeVisible()
    await expect(kpi(page, 'Avance')).toHaveCount(0)
  })

  test('renderiza todas las tarjetas de análisis', async ({ paginaAutenticada: page }) => {
    for (const titulo of ['Avance por actividad', 'Avance por alcance', 'Abiertos y atrasados por responsable', 'Módulos con más atrasos', 'Alertas por regla']) {
      await expect(tarjeta(page, titulo)).toBeVisible()
    }
    await expect(tarjeta(page, 'Avance por actividad').locator('svg').first()).toBeVisible()
  })

  test('el detalle por cliente y actividad se despliega', async ({ paginaAutenticada: page }) => {
    await page.getByText('Ver datos por cliente y actividad').click()
    await expect(page.getByRole('columnheader', { name: 'Atrasados' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Multifamiliares SCR' }).first()).toBeVisible()
  })

  test('sin ítems en el backlog muestra el estado vacío', async ({ paginaAutenticada: page, backend }) => {
    backend.estado.item = []
    await page.reload()
    await expect(page.getByText('Aún no hay ítems en el backlog.')).toBeVisible()
  })
})
