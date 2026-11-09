import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DataTable, Expander, Modal, Popover, Tabs } from '.'

describe('Tabs', () => {
  const pestanas = [
    { id: 'a', titulo: 'Primera', contenido: <p>Contenido A</p> },
    { id: 'b', titulo: 'Segunda', icono: 'category', contenido: <p>Contenido B</p> },
  ]

  it('muestra la primera pestaña y cambia al hacer clic', async () => {
    render(<Tabs pestanas={pestanas} />)
    expect(screen.getByText('Contenido A')).toBeInTheDocument()
    expect(screen.queryByText('Contenido B')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: /Segunda/ }))
    expect(screen.getByText('Contenido B')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Segunda/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Primera' })).toHaveAttribute('aria-selected', 'false')
  })
})

describe('Modal', () => {
  it('cierra con Escape', async () => {
    const alCerrar = vi.fn()
    render(
      <Modal titulo="Detalle" onCerrar={alCerrar}>
        Cuerpo
      </Modal>,
    )
    await userEvent.keyboard('{Escape}')
    expect(alCerrar).toHaveBeenCalledTimes(1)
  })

  it('cierra con el botón y al hacer clic fuera, pero no dentro', async () => {
    const alCerrar = vi.fn()
    const { container } = render(
      <Modal titulo="Detalle" onCerrar={alCerrar}>
        Cuerpo
      </Modal>,
    )
    await userEvent.click(screen.getByText('Cuerpo'))
    expect(alCerrar).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(alCerrar).toHaveBeenCalledTimes(1)
    await userEvent.click(container.firstChild)
    expect(alCerrar).toHaveBeenCalledTimes(2)
  })

  it('expone rol dialog con nombre accesible', () => {
    render(
      <Modal titulo="Detalle" onCerrar={() => {}}>
        x
      </Modal>,
    )
    expect(screen.getByRole('dialog', { name: 'Detalle' })).toBeInTheDocument()
  })

  it('retira el listener al desmontar', async () => {
    const alCerrar = vi.fn()
    const { unmount } = render(
      <Modal titulo="D" onCerrar={alCerrar}>
        x
      </Modal>,
    )
    unmount()
    await userEvent.keyboard('{Escape}')
    expect(alCerrar).not.toHaveBeenCalled()
  })
})

describe('Popover', () => {
  const renderPopover = (props) =>
    render(
      <div>
        <button>Fuera</button>
        <Popover
          renderTrigger={({ alternar }) => <button onClick={alternar}>Abrir</button>}
          {...props}
        >
          {({ cerrar }) => <button onClick={cerrar}>Contenido</button>}
        </Popover>
      </div>,
    )

  it('abre, y cierra con el contenido o al hacer clic fuera', async () => {
    renderPopover()
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('Abrir'))
    expect(screen.getByText('Contenido')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Contenido'))
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('Abrir'))
    await userEvent.click(screen.getByText('Fuera'))
    expect(screen.queryByText('Contenido')).not.toBeInTheDocument()
  })

  it('acepta hijos que no son función', async () => {
    render(<Popover renderTrigger={({ alternar }) => <button onClick={alternar}>Abrir</button>}>Texto fijo</Popover>)
    await userEvent.click(screen.getByText('Abrir'))
    expect(screen.getByText('Texto fijo')).toBeInTheDocument()
  })

  it('alinea a la derecha cuando se pide', async () => {
    renderPopover({ align: 'right' })
    await userEvent.click(screen.getByText('Abrir'))
    expect(screen.getByText('Contenido').closest('div.absolute')).toHaveClass('right-0')
  })
})

describe('Expander', () => {
  it('empieza cerrado y respeta la propiedad abierto', () => {
    const { container, rerender } = render(<Expander titulo="Más filtros">Dentro</Expander>)
    expect(container.querySelector('details')).not.toHaveAttribute('open')
    rerender(
      <Expander titulo="Más filtros" abierto>
        Dentro
      </Expander>,
    )
    expect(container.querySelector('details')).toHaveAttribute('open')
  })
})

describe('DataTable', () => {
  const columnas = [
    { clave: 'codigo', titulo: 'Código', fijo: true },
    { clave: 'nombre', titulo: 'Nombre', render: (fila) => <b>{fila.nombre.toUpperCase()}</b> },
  ]
  const filas = [
    { id: 1, codigo: 'BL-1', nombre: 'uno' },
    { id: 2, codigo: 'BL-2', nombre: 'dos' },
  ]

  it('renderiza encabezados, celdas y render personalizado', () => {
    render(<DataTable columnas={columnas} filas={filas} claveFila={(f) => f.id} />)
    expect(screen.getByText('Código')).toBeInTheDocument()
    expect(screen.getByText('BL-1')).toBeInTheDocument()
    expect(screen.getByText('UNO')).toBeInTheDocument()
  })

  it('muestra el mensaje de vacío', () => {
    render(<DataTable columnas={columnas} filas={[]} claveFila={(f) => f.id} vacio="Sin datos" />)
    expect(screen.getByText('Sin datos')).toBeInTheDocument()
  })

  it('selección simple: elige y des-elige la misma fila', async () => {
    const alSeleccionar = vi.fn()
    const { rerender } = render(
      <DataTable columnas={columnas} filas={filas} claveFila={(f) => f.id} seleccion={[]} alSeleccionar={alSeleccionar} />,
    )
    await userEvent.click(screen.getByText('BL-2'))
    expect(alSeleccionar).toHaveBeenLastCalledWith([2])
    rerender(<DataTable columnas={columnas} filas={filas} claveFila={(f) => f.id} seleccion={[2]} alSeleccionar={alSeleccionar} />)
    await userEvent.click(screen.getByText('BL-2'))
    expect(alSeleccionar).toHaveBeenLastCalledWith([])
    await userEvent.click(screen.getByText('BL-1'))
    expect(alSeleccionar).toHaveBeenLastCalledWith([1])
  })

  it('selección múltiple acumula y quita filas', async () => {
    const alSeleccionar = vi.fn()
    const { rerender } = render(
      <DataTable columnas={columnas} filas={filas} claveFila={(f) => f.id} multiple seleccion={[1]} alSeleccionar={alSeleccionar} />,
    )
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked()
    await userEvent.click(screen.getByText('BL-2'))
    expect(alSeleccionar).toHaveBeenLastCalledWith([1, 2])
    rerender(
      <DataTable columnas={columnas} filas={filas} claveFila={(f) => f.id} multiple seleccion={[1, 2]} alSeleccionar={alSeleccionar} />,
    )
    await userEvent.click(screen.getByText('BL-1'))
    expect(alSeleccionar).toHaveBeenLastCalledWith([2])
  })

  it('sin alSeleccionar las filas no son clicables', () => {
    render(<DataTable columnas={columnas} filas={filas} claveFila={(f) => f.id} />)
    expect(screen.getByText('BL-1').closest('tr')).not.toHaveClass('cursor-pointer')
  })
})
