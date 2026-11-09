import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Alert, Avatar, Button, Card, Chip, EmptyState, ErrorState, Hero, Kpi, KpiGrid, ListItem, LoadingState, Meter, Toolbar } from '.'

describe('Button', () => {
  it('dispara onClick y usa type button por defecto', async () => {
    const alClic = vi.fn()
    render(<Button onClick={alClic}>Guardar</Button>)
    const boton = screen.getByRole('button', { name: 'Guardar' })
    expect(boton).toHaveAttribute('type', 'button')
    await userEvent.click(boton)
    expect(alClic).toHaveBeenCalledTimes(1)
  })

  it('deshabilitado no dispara onClick', async () => {
    const alClic = vi.fn()
    render(
      <Button disabled onClick={alClic}>
        Guardar
      </Button>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(alClic).not.toHaveBeenCalled()
  })

  it('en carga se deshabilita y muestra el icono de progreso', () => {
    render(
      <Button loading icon="save">
        Guardar
      </Button>,
    )
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByText('progress_activity')).toBeInTheDocument()
    expect(screen.queryByText('save')).not.toBeInTheDocument()
  })

  it('muestra el icono indicado y aplica variante danger', () => {
    render(
      <Button icon="delete" variant="danger" full>
        Borrar
      </Button>,
    )
    expect(screen.getByText('delete')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveClass('bg-danger', 'w-full')
  })

  it('permite type submit', () => {
    render(<Button type="submit">Enviar</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })
})

describe('Card', () => {
  it('muestra título, icono, subtítulo, acciones y contenido', () => {
    render(
      <Card title="Bloqueantes" icon="report" subtitle="Escala o resuelve" actions={<button>Acción</button>}>
        <p>Contenido</p>
      </Card>,
    )
    expect(screen.getByRole('heading', { name: /Bloqueantes/ })).toBeInTheDocument()
    expect(screen.getByText('report')).toBeInTheDocument()
    expect(screen.getByText('Escala o resuelve')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Acción' })).toBeInTheDocument()
    expect(screen.getByText('Contenido')).toBeInTheDocument()
  })

  it('sin título ni acciones no renderiza cabecera', () => {
    render(<Card>Solo contenido</Card>)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})

describe('Chip', () => {
  it('aplica las clases del tono', () => {
    render(<Chip tono="rojo">Alta</Chip>)
    expect(screen.getByText('Alta')).toHaveClass('bg-danger-soft')
  })

  it('un tono desconocido cae en gris', () => {
    render(<Chip tono="inexistente">X</Chip>)
    expect(screen.getByText('X')).toHaveClass('bg-line-soft')
  })

  it('muestra el punto cuando se pide', () => {
    const { container } = render(<Chip punto>Con punto</Chip>)
    expect(container.querySelector('i')).toBeInTheDocument()
  })
})

describe('Kpi', () => {
  it('muestra etiqueta, valor y detalle', () => {
    render(<Kpi etiqueta="Avance" valor="42%" detalle="5 terminados" color="#059669" />)
    expect(screen.getByText('Avance')).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()
    expect(screen.getByText('5 terminados')).toBeInTheDocument()
  })

  it('limita la barra de porcentaje entre 0 y 100', () => {
    const { container, rerender } = render(<Kpi etiqueta="A" valor="1" color="#000" porcentaje={250} />)
    expect(container.querySelector('i')).toHaveStyle({ width: '100%' })
    rerender(<Kpi etiqueta="A" valor="1" color="#000" porcentaje={-5} />)
    expect(container.querySelector('i')).toHaveStyle({ width: '0%' })
  })

  it('sin porcentaje no dibuja barra', () => {
    const { container } = render(<Kpi etiqueta="A" valor="1" color="#000" />)
    expect(container.querySelector('i')).not.toBeInTheDocument()
  })

  it('KpiGrid renderiza a sus hijos', () => {
    render(
      <KpiGrid>
        <Kpi etiqueta="Uno" valor="1" color="#000" />
        <Kpi etiqueta="Dos" valor="2" color="#000" />
      </KpiGrid>,
    )
    expect(screen.getAllByText(/Uno|Dos/)).toHaveLength(2)
  })
})

describe('ListItem', () => {
  it('muestra id, título, cuerpo, chips y metadatos', () => {
    render(
      <ListItem
        id="BL-001"
        titulo="Mapa"
        cuerpo="Detalle"
        chips={[['Alta', 'rojo']]}
        meta={['Responsable: Ana', 'Hace 3 h']}
      />,
    )
    expect(screen.getByText('BL-001')).toBeInTheDocument()
    expect(screen.getByText('Mapa')).toBeInTheDocument()
    expect(screen.getByText('Detalle')).toBeInTheDocument()
    expect(screen.getByText('Alta')).toBeInTheDocument()
    expect(screen.getByText('Hace 3 h')).toBeInTheDocument()
  })

  it('marca alerta y selección con clases propias', () => {
    render(<ListItem id="X" alerta seleccionado />)
    expect(screen.getByRole('article')).toHaveClass('border-l-danger', 'border-brand')
  })
})

describe('EmptyState, Alert y estados de carga', () => {
  it('EmptyState muestra el mensaje', () => {
    render(<EmptyState>No hay ceremonias.</EmptyState>)
    expect(screen.getByText('No hay ceremonias.')).toBeInTheDocument()
  })

  it.each([
    ['exito', 'check_circle'],
    ['info', 'info'],
    ['aviso', 'warning'],
    ['error', 'error'],
  ])('Alert %s usa el icono %s', (tono, icono) => {
    render(<Alert tono={tono}>Mensaje</Alert>)
    expect(screen.getByRole('alert')).toHaveTextContent('Mensaje')
    expect(screen.getByText(icono)).toBeInTheDocument()
  })

  it('Alert permite icono personalizado', () => {
    render(<Alert icono="mail">Correo</Alert>)
    expect(screen.getByText('mail')).toBeInTheDocument()
  })

  it('LoadingState y ErrorState', () => {
    const { rerender } = render(<LoadingState />)
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    rerender(<ErrorState error={new Error('sin red')} />)
    expect(screen.getByText(/sin red/)).toBeInTheDocument()
    rerender(<ErrorState />)
    expect(screen.getByText(/error desconocido/)).toBeInTheDocument()
  })
})

describe('Hero, Avatar, Meter, Toolbar', () => {
  it('Hero muestra kicker, título, subtítulo e insignias', () => {
    render(<Hero kicker="CRONOGRAMA" titulo="Planificado" subtitulo="Detalle" insignias={[['Correo activo', 'oscuro']]} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Planificado' })).toBeInTheDocument()
    expect(screen.getByText('CRONOGRAMA')).toBeInTheDocument()
    expect(screen.getByText('Detalle')).toBeInTheDocument()
    expect(screen.getByText('Correo activo')).toBeInTheDocument()
  })

  it('Hero sin subtítulo ni insignias', () => {
    render(<Hero kicker="K" titulo="T" />)
    expect(screen.queryByText('Detalle')).not.toBeInTheDocument()
  })

  it('Avatar muestra iniciales', () => {
    render(<Avatar nombre="Luis Kendor" />)
    expect(screen.getByText('LK')).toBeInTheDocument()
  })

  it('Meter limita el ancho a 100%', () => {
    const { container } = render(<Meter porcentaje={180} />)
    expect(container.querySelector('i')).toHaveStyle({ width: '100%' })
  })

  it('Toolbar envuelve contenido', () => {
    render(<Toolbar>Filtros</Toolbar>)
    expect(screen.getByText('Filtros')).toBeInTheDocument()
  })
})
