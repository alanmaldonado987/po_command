import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../test/apiFalsa'
import { argumentoDe } from '../test/ayudas'
import { crearItem } from '../test/fabricas'
import { renderizar } from '../test/renderizar'
import Configuracion from './Configuracion'

vi.mock('../api/items', async () => (await import('../test/apiFalsa')).items)
vi.mock('../api/catalogos', async () => (await import('../test/apiFalsa')).catalogos)
vi.mock('../api/correo', async () => (await import('../test/apiFalsa')).correo)
vi.mock('../api/configuracion', async () => (await import('../test/apiFalsa')).configuracion)
vi.mock('../api/clickup', async () => (await import('../test/apiFalsa')).clickup)

const usuario = userEvent.setup({ delay: null })
const PLAN = resolve(__dirname, '../../../data_inicial/plan_de_trabajo.xlsx')

const catalogoClientes = [
  { id: 1, nombre: 'AIR-E', descripcion: 'Atlántico', estado: 'Activo' },
  { id: 2, nombre: 'AFINIA', descripcion: '', estado: 'Pausado' },
]

beforeEach(() => {
  api.reiniciarApiFalsa()
  api.catalogos.listarCatalogo.mockImplementation(async (tabla) => (tabla === 'cliente' ? catalogoClientes : []))
  api.items.listarItems.mockResolvedValue([
    crearItem({ cliente_id: 1 }),
    crearItem({ cliente_id: 1 }),
    crearItem({ cliente_id: 2 }),
  ])
})

const tarjetaPo = () => screen.getByText('Product Owner').closest('section')

const abrirPestana = async (nombre) => usuario.click(await screen.findByRole('tab', { name: new RegExp(nombre) }))

describe('Configuración · tarjetas', () => {
  it('muestra datos del PO, estado del correo y conteo de la base', async () => {
    renderizar(<Configuracion />)
    expect(await screen.findByDisplayValue('Verónica')).toBeInTheDocument()
    expect(screen.getByDisplayValue('vero@ises.com.co')).toBeInTheDocument()
    expect(await screen.findByText('Simulación')).toBeInTheDocument()
    expect(screen.getByText(/smtp\.office365\.com:587 \(starttls\)/)).toBeInTheDocument()
    expect(screen.getByText('Supabase · PostgreSQL · 3 ítems del backlog')).toBeInTheDocument()
  })

  it('guarda nombre y correo del PO recortando espacios', async () => {
    renderizar(<Configuracion />)
    const nombre = await screen.findByDisplayValue('Verónica')
    await usuario.clear(nombre)
    await usuario.type(nombre, 'Verónica R.')
    const correo = screen.getByDisplayValue('vero@ises.com.co')
    await usuario.clear(correo)
    await usuario.type(correo, '  nuevo@ises.com.co ')
    await usuario.click(within(tarjetaPo()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.configuracion.guardarConfiguracion).toHaveBeenCalledTimes(2))
    expect(api.configuracion.guardarConfiguracion.mock.calls.map(([clave, valor]) => [clave, valor])).toEqual([
      ['po_nombre', 'Verónica R.'],
      ['po_correo', 'nuevo@ises.com.co'],
    ])
    expect(await screen.findByText('Datos del PO guardados.')).toBeInTheDocument()
  })

  it('si el guardado del PO falla muestra el error', async () => {
    api.configuracion.guardarConfiguracion.mockRejectedValue(new Error('sin permisos'))
    renderizar(<Configuracion />)
    await screen.findByDisplayValue('Verónica')
    await usuario.click(within(tarjetaPo()).getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('sin permisos')).toBeInTheDocument()
  })
})

describe('Configuración · catálogos', () => {
  it('lista los registros con el número de ítems que los usan', async () => {
    renderizar(<Configuracion />)
    expect(await screen.findByDisplayValue('AIR-E')).toBeInTheDocument()
    expect(screen.getByText('2 ítems')).toBeInTheDocument()
    expect(screen.getByText('1 ítems')).toBeInTheDocument()
  })

  it('agrega un registro nuevo', async () => {
    renderizar(<Configuracion />)
    const vacio = (await screen.findAllByPlaceholderText('Nuevo registro'))[0]
    await usuario.type(vacio, '  ACUACAR ')
    await usuario.click(screen.getByRole('button', { name: 'Agregar' }))
    await waitFor(() => expect(api.catalogos.crearRegistro).toHaveBeenCalled())
    expect(api.catalogos.crearRegistro.mock.calls[0].slice(0, 2)).toEqual([
      'cliente',
      { nombre: 'ACUACAR', descripcion: '', estado: 'Activo' },
    ])
    expect(await screen.findByText('Registro agregado.')).toBeInTheDocument()
  })

  it('traduce el error de nombre duplicado', async () => {
    api.catalogos.crearRegistro.mockRejectedValue(new Error('duplicate key value violates unique constraint'))
    renderizar(<Configuracion />)
    await usuario.type((await screen.findAllByPlaceholderText('Nuevo registro'))[0], 'AIR-E')
    await usuario.click(screen.getByRole('button', { name: 'Agregar' }))
    expect(await screen.findByText('Ya existe un registro con ese nombre.')).toBeInTheDocument()
  })

  it('edita un registro y habilita Guardar solo si cambió', async () => {
    renderizar(<Configuracion />)
    const nombre = await screen.findByDisplayValue('AFINIA')
    const fila = nombre.closest('div.rounded-xl')
    expect(within(fila).getByRole('button', { name: 'Guardar' })).toBeDisabled()
    await usuario.type(nombre, ' S.A.')
    await usuario.click(within(fila).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.catalogos.actualizarRegistro).toHaveBeenCalled())
    expect(api.catalogos.actualizarRegistro.mock.calls[0].slice(0, 3)).toEqual([
      'cliente',
      2,
      { nombre: 'AFINIA S.A.', descripcion: '', estado: 'Pausado' },
    ])
  })

  it('pide confirmación antes de eliminar y muestra los ítems afectados', async () => {
    renderizar(<Configuracion />)
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar AIR-E' }))
    expect(screen.getByText(/2 ítem\(s\) quedarán sin este dato\. ¿Eliminar\?/)).toBeInTheDocument()
    expect(api.catalogos.eliminarRegistro).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole('button', { name: 'No' }))
    expect(api.catalogos.eliminarRegistro).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole('button', { name: 'Eliminar AIR-E' }))
    await usuario.click(screen.getByRole('button', { name: 'Sí' }))
    await waitFor(() => expect(api.catalogos.eliminarRegistro).toHaveBeenCalled())
    expect(api.catalogos.eliminarRegistro.mock.calls[0].slice(0, 2)).toEqual(['cliente', 1])
    expect(await screen.findByText('Registro eliminado.')).toBeInTheDocument()
  })

  it('cambia de catálogo', async () => {
    renderizar(<Configuracion />)
    await screen.findByDisplayValue('AIR-E')
    await usuario.click(screen.getByRole('button', { name: 'Actividades' }))
    await waitFor(() => expect(api.catalogos.listarCatalogo).toHaveBeenCalledWith('actividad'))
    expect(screen.queryByDisplayValue('AIR-E')).not.toBeInTheDocument()
  })
})

describe('Configuración · importar Plan de Trabajo', () => {
  const subir = async (archivo) => {
    renderizar(<Configuracion />)
    await abrirPestana('Importar')
    await usuario.upload(document.querySelector('input[type=file]'), archivo)
  }

  it('lee el Excel real, previsualiza y confirma la importación', async () => {
    api.configuracion.importarPlan.mockImplementation(async (filas, simular) =>
      simular
        ? { nuevos: filas.length, actualizados: 0, sin_cambios: 0, reprogramaciones: 0, notas: 0, personas_nuevas: ['Dairo Carrasquilla'] }
        : { nuevos: filas.length, actualizados: 0, sin_cambios: 0, reprogramaciones: 0, notas: 152, personas_nuevas: [] },
    )
    const bytes = readFileSync(PLAN)
    await subir(new File([bytes], 'plan.xlsx'))

    expect(await screen.findByText(/274 filas leídas/)).toBeInTheDocument()
    expect(screen.getByText(/274 nuevas · 0 ya existen/)).toBeInTheDocument()
    expect(screen.getByText(/Se agregarán al equipo \(sin correo\): Dairo Carrasquilla/)).toBeInTheDocument()
    expect(api.configuracion.importarPlan.mock.calls[0][1]).toBe(true)
    expect(api.configuracion.importarPlan.mock.calls[0][0]).toHaveLength(274)

    await usuario.click(screen.getByRole('button', { name: 'Importar 274 filas' }))
    expect(await screen.findByText(/Importación lista: 274 ítems nuevos/)).toBeInTheDocument()
    expect(screen.getByText(/152 notas nuevas en la bitácora/)).toBeInTheDocument()
    expect(api.configuracion.importarPlan.mock.calls[1][1]).toBe(false)
    expect(screen.queryByRole('button', { name: /Importar \d+ filas/ })).not.toBeInTheDocument()
  })

  it('un archivo sin filas del plan muestra el error', async () => {
    const { default: XLSX } = await import('xlsx').then((modulo) => ({ default: modulo }))
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([['otra', 'cosa']]), 'Hoja')
    const bytes = XLSX.write(libro, { type: 'array', bookType: 'xlsx' })
    await subir(new File([bytes], 'vacio.xlsx'))
    expect(await screen.findByText(/No encontré filas del plan en ese archivo/)).toBeInTheDocument()
    expect(api.configuracion.importarPlan).not.toHaveBeenCalled()
  })

  it('si la importación falla muestra el error y conserva la vista previa', async () => {
    api.configuracion.importarPlan.mockResolvedValueOnce({ nuevos: 274, actualizados: 0, sin_cambios: 0, reprogramaciones: 0, notas: 0, personas_nuevas: [] })
    api.configuracion.importarPlan.mockRejectedValueOnce(new Error('timeout de la base'))
    await subir(new File([readFileSync(PLAN)], 'plan.xlsx'))
    await usuario.click(await screen.findByRole('button', { name: 'Importar 274 filas' }))
    expect(await screen.findByText('timeout de la base')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importar 274 filas' })).toBeInTheDocument()
  })
})

describe('Configuración · exportar y auditoría', () => {
  it('muestra los botones de exportación', async () => {
    renderizar(<Configuracion />)
    await abrirPestana('Exportar')
    expect(await screen.findByRole('button', { name: 'Descargar backlog en formato Plan de Trabajo' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Exportar todas las tablas (técnico)' })).toBeInTheDocument()
  })

  it('la exportación del plan se deshabilita sin ítems', async () => {
    api.items.listarItems.mockResolvedValue([])
    renderizar(<Configuracion />)
    await abrirPestana('Exportar')
    expect(await screen.findByRole('button', { name: 'Descargar backlog en formato Plan de Trabajo' })).toBeDisabled()
  })

  it('lista los registros de auditoría', async () => {
    api.configuracion.listarAuditoria.mockResolvedValue([
      { id: 1, fecha: '2026-11-06T14:00:00Z', entidad: 'item', entidad_id: 5, accion: 'editar', detalle: 'BL-005 Mapa' },
    ])
    renderizar(<Configuracion />)
    await abrirPestana('Auditoría')
    expect(await screen.findByText('BL-005 Mapa')).toBeInTheDocument()
    expect(argumentoDe(api.configuracion.listarAuditoria) ?? undefined).toBeUndefined()
  })

  it('auditoría vacía y con error', async () => {
    renderizar(<Configuracion />)
    await abrirPestana('Auditoría')
    expect(await screen.findByText('Sin registros de auditoría')).toBeInTheDocument()
  })
})

describe('Configuración · ClickUp', () => {
  it('la pestaña ClickUp muestra la conexión y la guía de configuración', async () => {
    renderizar(<Configuracion />)
    await abrirPestana('ClickUp')
    expect(await screen.findByRole('heading', { name: 'Conexión' })).toBeInTheDocument()
    expect(screen.getByText(/La sincronización con ClickUp está desactivada/)).toBeInTheDocument()
    expect(api.clickup.obtenerEstadoClickUp).toHaveBeenCalled()
  })

  it('el estado de ClickUp solo se consulta al abrir la pestaña', async () => {
    renderizar(<Configuracion />)
    await screen.findByDisplayValue('Verónica')
    expect(api.clickup.obtenerEstadoClickUp).not.toHaveBeenCalled()
  })
})
