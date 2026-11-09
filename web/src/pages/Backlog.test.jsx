import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../test/apiFalsa'
import { argumentoDe } from '../test/ayudas'
import { crearItem, crearNota, crearPersona } from '../test/fabricas'
import { renderizar } from '../test/renderizar'
import Backlog from './Backlog'

vi.mock('../api/items', async () => (await import('../test/apiFalsa')).items)
vi.mock('../api/catalogos', async () => (await import('../test/apiFalsa')).catalogos)
vi.mock('../api/personas', async () => (await import('../test/apiFalsa')).personas)
vi.mock('../api/alertas', async () => (await import('../test/apiFalsa')).alertas)
vi.mock('../api/configuracion', async () => (await import('../test/apiFalsa')).configuracion)
vi.mock('../api/clickup', async () => (await import('../test/apiFalsa')).clickup)

const mapa = crearItem({ id: 1, codigo: 'BL-001', titulo: 'Mapa de rutas', funcionalidad: 'Mapa de rutas', cliente: 'AIR-E', cliente_id: 1 })
const facturas = crearItem({
  id: 2,
  codigo: 'BL-002',
  titulo: 'Facturación',
  funcionalidad: 'Facturación',
  cliente: 'AFINIA',
  cliente_id: 2,
  bloqueado: true,
  motivo_bloqueo: 'Sin API',
  alcance: 'Mobile',
})
const cierre = crearItem({ id: 3, codigo: 'BL-003', titulo: 'Cierre', funcionalidad: 'Cierre', estado: 'Terminado', atrasado: false })
const vencido = crearItem({ id: 4, codigo: 'BL-004', titulo: 'Reporte', funcionalidad: 'Reporte', atrasado: true, atraso_dias: 8, fecha_compromiso: '2026-01-01' })

const usuario = userEvent.setup({ delay: null })

beforeEach(() => {
  api.reiniciarApiFalsa()
  api.items.listarItems.mockResolvedValue([mapa, facturas, cierre, vencido])
  api.catalogos.listarCatalogo.mockImplementation(async (tabla) =>
    ({
      cliente: [{ id: 1, nombre: 'AIR-E' }, { id: 2, nombre: 'AFINIA' }],
      actividad: [{ id: 1, nombre: 'SCR' }],
      modulo: [{ id: 1, nombre: 'Torre de Control' }],
      producto: [{ id: 1, nombre: 'FieldOps' }],
    })[tabla],
  )
  api.personas.listarPersonas.mockResolvedValue([crearPersona({ id: 1, nombre: 'Luis Kendor', tipo: 'equipo' })])
})

const campoFiltro = (nombre) =>
  screen.getAllByText(nombre).find((el) => el.classList.contains('field-label')).parentElement

const filas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)

describe('Backlog · tabla y filtros', () => {
  it('muestra el estado de carga y el de error', async () => {
    api.items.listarItems.mockReturnValue(new Promise(() => {}))
    const { unmount } = renderizar(<Backlog />)
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    unmount()
    api.items.listarItems.mockRejectedValue(new Error('sin permisos'))
    renderizar(<Backlog />)
    expect(await screen.findByText(/sin permisos/)).toBeInTheDocument()
  })

  it('lista los ítems con su resumen', async () => {
    renderizar(<Backlog />)
    expect(await screen.findByText('4 ítems · 3 abiertos · 1 atrasados')).toBeInTheDocument()
    expect(filas()).toHaveLength(4)
    expect(screen.getByText('Bloqueado')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('sin ítems muestra el estado vacío y deshabilita la descarga', async () => {
    api.items.listarItems.mockResolvedValue([])
    renderizar(<Backlog />)
    expect(await screen.findByText('No hay ítems que coincidan con el filtro.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Descargar en formato Plan de Trabajo/ })).toBeDisabled()
  })

  it('busca por texto en código y título', async () => {
    renderizar(<Backlog />)
    await screen.findByText('4 ítems · 3 abiertos · 1 atrasados')
    await usuario.type(screen.getByLabelText(/Buscar/), 'zzz')
    expect(await screen.findByText('No hay ítems que coincidan con el filtro.')).toBeInTheDocument()
    await usuario.clear(screen.getByLabelText(/Buscar/))
    await usuario.type(screen.getByLabelText(/Buscar/), 'bl-002')
    await waitFor(() => expect(filas()).toHaveLength(1))
    expect(screen.getByText('Facturación')).toBeInTheDocument()
  })

  it('la búsqueda incluye el texto de las notas', async () => {
    api.items.listarTodasLasNotas.mockResolvedValue([crearNota({ item_id: 3, texto: 'Esperando firma del cliente' })])
    renderizar(<Backlog />)
    await screen.findByText('4 ítems · 3 abiertos · 1 atrasados')
    await usuario.type(screen.getByLabelText(/Buscar/), 'firma')
    await waitFor(() => expect(filas()).toHaveLength(1))
    expect(screen.getByText('Cierre')).toBeInTheDocument()
  })

  it('filtra por cliente desde el selector múltiple', async () => {
    renderizar(<Backlog />)
    await screen.findByText('4 ítems · 3 abiertos · 1 atrasados')
    const filtroCliente = campoFiltro('Cliente')
    await usuario.click(within(filtroCliente).getByRole('button'))
    await usuario.click(await screen.findByLabelText('AFINIA'))
    await waitFor(() => expect(filas()).toHaveLength(1))
    expect(screen.getByText('1 ítems · 1 abiertos · 0 atrasados')).toBeInTheDocument()
  })

  it('filtra por los estados virtuales Bloqueado y Atrasado', async () => {
    renderizar(<Backlog />)
    await screen.findByText('4 ítems · 3 abiertos · 1 atrasados')
    const filtroEstado = campoFiltro('Estado')
    await usuario.click(within(filtroEstado).getByRole('button'))
    await usuario.click(await screen.findByLabelText('Atrasado'))
    await waitFor(() => expect(filas()).toHaveLength(1))
    expect(screen.getByText('Reporte')).toBeInTheDocument()
  })
})

describe('Backlog · editor', () => {
  it('Nuevo ítem abre el formulario con la ayuda', async () => {
    renderizar(<Backlog />)
    await usuario.click(await screen.findByRole('button', { name: /Nuevo ítem/ }))
    expect(screen.getByText('Nuevo ítem del backlog')).toBeInTheDocument()
    expect(screen.getByText('Antes de crear')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Producto' })).toHaveValue('FieldOps')
  })

  it('seleccionar una fila abre el editor con bitácora, destinatarios y acciones', async () => {
    api.items.listarNotas.mockResolvedValue([crearNota({ item_id: 1, texto: 'Primera nota', tipo: 'Ejecución', autor: 'Vero' })])
    api.alertas.resolverDestinatarios.mockResolvedValue([{ nombre: 'Ana', correo: 'ana@x.co', rol: 'Stakeholder' }])
    renderizar(<Backlog />)
    await usuario.click(await screen.findByText('Mapa de rutas'))
    expect(await screen.findByText('Editar BL-001')).toBeInTheDocument()
    expect(await screen.findByText('Primera nota')).toBeInTheDocument()
    expect(await screen.findByText('Stakeholder · ana@x.co')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Duplicar ítem' })).toBeInTheDocument()
    expect(screen.getByLabelText('Menú / funcionalidad *')).toHaveValue('Mapa de rutas')
  })

  it('avisa cuando no hay destinatarios para un bloqueo', async () => {
    renderizar(<Backlog />)
    await usuario.click(await screen.findByText('Mapa de rutas'))
    expect(await screen.findByText(/No hay destinatarios con correo válido/)).toBeInTheDocument()
  })

  it('elimina notas de la bitácora', async () => {
    api.items.listarNotas.mockResolvedValue([crearNota({ id: 55, item_id: 1, texto: 'Borrar esto' })])
    renderizar(<Backlog />)
    await usuario.click(await screen.findByText('Mapa de rutas'))
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar nota' }))
    await waitFor(() => expect(api.items.eliminarNota).toHaveBeenCalled())
    expect(argumentoDe(api.items.eliminarNota)).toBe(55)
  })

  it('Cerrar oculta el editor', async () => {
    renderizar(<Backlog />)
    await usuario.click(await screen.findByRole('button', { name: /Nuevo ítem/ }))
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByText('Nuevo ítem del backlog')).not.toBeInTheDocument()
  })

  it('Duplicar abre un ítem nuevo con los datos del original', async () => {
    renderizar(<Backlog />)
    await usuario.click(await screen.findByText('Mapa de rutas'))
    await usuario.click(await screen.findByRole('button', { name: 'Duplicar ítem' }))
    expect(await screen.findByText('Nuevo ítem (copia de BL-001)')).toBeInTheDocument()
    expect(screen.getByLabelText('Menú / funcionalidad *')).toHaveValue('Mapa de rutas')
    expect(screen.getByRole('button', { name: 'Crear ítem' })).toBeInTheDocument()
  })
})

describe('Backlog · crear y editar', () => {
  async function abrirNuevo() {
    renderizar(<Backlog />)
    await usuario.click(await screen.findByRole('button', { name: /Nuevo ítem/ }))
  }

  it('valida los campos obligatorios y no guarda', async () => {
    await abrirNuevo()
    await usuario.click(screen.getByRole('button', { name: 'Crear ítem' }))
    expect(await screen.findByText(/Completa los campos con \*/)).toBeInTheDocument()
    expect(api.items.guardarItem).not.toHaveBeenCalled()
  })

  it('valida fechas fin anteriores al inicio y el motivo del bloqueo', async () => {
    await abrirNuevo()
    await usuario.type(screen.getByLabelText('Cliente *'), 'AIR-E')
    await usuario.type(screen.getByLabelText('Actividad *'), 'SCR')
    await usuario.type(screen.getByLabelText('Módulo / componente *'), 'Órdenes')
    await usuario.type(screen.getByLabelText('Menú / funcionalidad *'), 'Completo')
    await usuario.selectOptions(screen.getByLabelText('Alcance *'), 'Web')
    await usuario.type(screen.getByLabelText('Inicio desarrollo / customización'), '2026-03-10')
    await usuario.type(screen.getByLabelText('Fin desarrollo / customización'), '2026-03-01')
    await usuario.click(screen.getByRole('switch', { name: 'Ítem bloqueado' }))
    await usuario.click(screen.getByRole('button', { name: 'Crear ítem' }))
    expect(await screen.findByText(/En desarrollo planificado la fecha fin es anterior/)).toBeInTheDocument()
    expect(screen.getByText(/Indica el motivo del bloqueo/)).toBeInTheDocument()
    expect(api.items.guardarItem).not.toHaveBeenCalled()
  })

  it('crea el ítem con los datos del formulario y avisa del resultado', async () => {
    api.alertas.notificarItemGuardado.mockResolvedValue({ mensaje: 'Alerta enviada.' })
    await abrirNuevo()
    await usuario.type(screen.getByLabelText('Cliente *'), 'AIR-E')
    await usuario.type(screen.getByLabelText('Actividad *'), 'SCR')
    await usuario.type(screen.getByLabelText('Módulo / componente *'), 'Órdenes')
    await usuario.type(screen.getByLabelText('Menú / funcionalidad *'), 'Completo')
    await usuario.selectOptions(screen.getByLabelText('Alcance *'), 'Web')
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Responsable' }), 'Luis Kendor')
    await usuario.type(screen.getByLabelText('Fin desarrollo / customización'), '2026-03-10')
    await usuario.type(screen.getByLabelText('Nueva nota para la bitácora'), 'Arranca el desarrollo')
    await usuario.click(screen.getByRole('button', { name: 'Crear ítem' }))

    await waitFor(() => expect(api.items.guardarItem).toHaveBeenCalled())
    expect(argumentoDe(api.items.guardarItem)).toMatchObject({
      id: null,
      nota: 'Arranca el desarrollo',
      tipoNota: 'Seguimiento',
      autor: 'Verónica',
      datos: {
        producto: 'FieldOps',
        cliente: 'AIR-E',
        actividad: 'SCR',
        modulo: 'Órdenes',
        funcionalidad: 'Completo',
        alcance: 'Web',
        responsable_id: 1,
        plan_fin: '2026-03-10',
        bloqueado: false,
        motivo_bloqueo: '',
      },
    })
    expect(argumentoDe(api.alertas.notificarItemGuardado)).toMatchObject({ codigo: 'BL-099' })
    expect(await screen.findByText('BL-099 guardado en la base de datos. Alerta enviada.')).toBeInTheDocument()
  })

  it.each([
    ['Urgente', 'Urgente'],
    [undefined, null],
  ])('al crear envía la prioridad elegida (%s) o null si queda sin prioridad', async (elegida, esperada) => {
    await abrirNuevo()
    await usuario.type(screen.getByLabelText('Cliente *'), 'AIR-E')
    await usuario.type(screen.getByLabelText('Actividad *'), 'SCR')
    await usuario.type(screen.getByLabelText('Módulo / componente *'), 'Órdenes')
    await usuario.type(screen.getByLabelText('Menú / funcionalidad *'), 'Completo')
    await usuario.selectOptions(screen.getByLabelText('Alcance *'), 'Web')
    if (elegida) await usuario.selectOptions(screen.getByRole('combobox', { name: 'Prioridad' }), elegida)
    await usuario.click(screen.getByRole('button', { name: 'Crear ítem' }))

    await waitFor(() => expect(api.items.guardarItem).toHaveBeenCalled())
    expect(argumentoDe(api.items.guardarItem).datos.prioridad).toBe(esperada)
  })

  it('menciona el cambio de fechas cuando la RPC lo reporta', async () => {
    api.items.guardarItem.mockResolvedValue({
      id: 1,
      codigo: 'BL-001',
      antes: { bloqueado: false },
      cambios: [{ campo: 'plan_fin', antes: '2026-01-01', despues: '2026-02-01' }],
      sin_cambios: false,
    })
    renderizar(<Backlog />)
    await usuario.click(await screen.findByText('Mapa de rutas'))
    await usuario.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText(/Cambio de fechas registrado en la bitácora\./)).toBeInTheDocument()
    expect(argumentoDe(api.items.guardarItem).id).toBe(1)
  })

  it('si falla el aviso, el ítem queda guardado y se informa', async () => {
    api.alertas.notificarItemGuardado.mockRejectedValue(new Error('función no desplegada'))
    await abrirNuevo()
    await usuario.type(screen.getByLabelText('Cliente *'), 'AIR-E')
    await usuario.type(screen.getByLabelText('Actividad *'), 'SCR')
    await usuario.type(screen.getByLabelText('Módulo / componente *'), 'Órdenes')
    await usuario.type(screen.getByLabelText('Menú / funcionalidad *'), 'Completo')
    await usuario.selectOptions(screen.getByLabelText('Alcance *'), 'Web')
    await usuario.click(screen.getByRole('button', { name: 'Crear ítem' }))
    expect(await screen.findByText(/No se pudo avisar: función no desplegada/)).toBeInTheDocument()
  })

  it('si falla el guardado muestra el error en el formulario', async () => {
    api.items.guardarItem.mockRejectedValue(new Error('La funcionalidad es obligatoria'))
    renderizar(<Backlog />)
    await usuario.click(await screen.findByText('Mapa de rutas'))
    await usuario.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('La funcionalidad es obligatoria')).toBeInTheDocument()
  })
})

describe('Backlog · eliminar', () => {
  it('pide confirmación y elimina con el conteo de alertas canceladas', async () => {
    renderizar(<Backlog />)
    await usuario.click(await screen.findByText('Mapa de rutas'))
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar ítem' }))
    expect(screen.getByText(/¿Eliminar BL-001\?/)).toBeInTheDocument()
    expect(api.items.eliminarItem).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole('button', { name: 'Sí, eliminar' }))
    await waitFor(() => expect(api.items.eliminarItem).toHaveBeenCalled())
    expect(argumentoDe(api.items.eliminarItem)).toBe(1)
    expect(await screen.findByText('BL-001 eliminado; 2 alerta(s) programada(s) cancelada(s).')).toBeInTheDocument()
  })

  it('Cancelar la confirmación no elimina', async () => {
    renderizar(<Backlog />)
    await usuario.click(await screen.findByText('Mapa de rutas'))
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar ítem' }))
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText(/¿Eliminar BL-001\?/)).not.toBeInTheDocument()
    expect(api.items.eliminarItem).not.toHaveBeenCalled()
  })

  it('muestra el error si no se puede eliminar', async () => {
    api.items.eliminarItem.mockRejectedValue(new Error('El ítem 1 no existe'))
    renderizar(<Backlog />)
    await usuario.click(await screen.findByText('Mapa de rutas'))
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar ítem' }))
    await usuario.click(screen.getByRole('button', { name: 'Sí, eliminar' }))
    expect(await screen.findByText('El ítem 1 no existe')).toBeInTheDocument()
  })
})
