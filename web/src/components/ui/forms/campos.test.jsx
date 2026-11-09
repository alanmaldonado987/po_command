import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  ComboField,
  DateField,
  MultiSelectField,
  NumberField,
  PillsSelect,
  SegmentedControl,
  SelectField,
  TextAreaField,
  TextField,
  Toggle,
} from '..'

describe('TextField', () => {
  it('asocia la etiqueta y devuelve el valor como texto', async () => {
    const alCambiar = vi.fn()
    render(<TextField label="Nombre" value="" onChange={alCambiar} />)
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ana')
    expect(alCambiar).toHaveBeenLastCalledWith('a')
    expect(alCambiar).toHaveBeenCalledTimes(3)
  })

  it('muestra ayuda e icono', () => {
    render(<TextField label="Buscar" ayuda="Escribe algo" icono="search" value="" onChange={() => {}} />)
    expect(screen.getByText('Escribe algo')).toBeInTheDocument()
    expect(screen.getByText('search')).toBeInTheDocument()
  })
})

describe('TextAreaField', () => {
  it('propaga el texto', async () => {
    const alCambiar = vi.fn()
    render(<TextAreaField label="Notas" value="" onChange={alCambiar} />)
    await userEvent.type(screen.getByLabelText('Notas'), 'x')
    expect(alCambiar).toHaveBeenCalledWith('x')
  })
})

describe('SelectField', () => {
  const opciones = [
    { value: 1, label: 'Uno' },
    { value: 2, label: 'Dos' },
  ]

  it('devuelve el valor numérico original, no el texto', async () => {
    const alCambiar = vi.fn()
    render(<SelectField label="Responsable" opciones={opciones} value={null} onChange={alCambiar} placeholder="Sin asignar" />)
    await userEvent.selectOptions(screen.getByLabelText('Responsable'), 'Dos')
    expect(alCambiar).toHaveBeenCalledWith(2)
  })

  it('al elegir el placeholder devuelve null', async () => {
    const alCambiar = vi.fn()
    render(<SelectField label="Responsable" opciones={opciones} value={1} onChange={alCambiar} placeholder="Sin asignar" />)
    await userEvent.selectOptions(screen.getByLabelText('Responsable'), 'Sin asignar')
    expect(alCambiar).toHaveBeenCalledWith(null)
  })

  it('acepta una lista de textos simples', () => {
    render(<SelectField label="Fase" opciones={['Desarrollo', 'Customización']} value="Customización" onChange={() => {}} />)
    expect(screen.getByLabelText('Fase')).toHaveValue('Customización')
  })

  it('muestra el valor actual numérico como seleccionado', () => {
    render(<SelectField label="R" opciones={opciones} value={2} onChange={() => {}} />)
    expect(screen.getByRole('combobox')).toHaveValue('2')
  })
})

describe('MultiSelectField', () => {
  const opciones = ['AIR-E', 'AFINIA', 'ACUACAR']

  it('muestra el placeholder y alterna opciones', async () => {
    const alCambiar = vi.fn()
    render(<MultiSelectField label="Cliente" opciones={opciones} value={[]} onChange={alCambiar} />)
    expect(screen.getByText('Todos')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByLabelText('AFINIA'))
    expect(alCambiar).toHaveBeenCalledWith(['AFINIA'])
  })

  it('quita una opción ya seleccionada y lista las etiquetas elegidas', async () => {
    const alCambiar = vi.fn()
    render(<MultiSelectField label="Cliente" opciones={opciones} value={['AIR-E', 'AFINIA']} onChange={alCambiar} />)
    expect(screen.getByText('AIR-E, AFINIA')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByLabelText('AIR-E'))
    expect(alCambiar).toHaveBeenCalledWith(['AFINIA'])
  })

  it('maneja opciones numéricas con etiqueta', async () => {
    const alCambiar = vi.fn()
    render(<MultiSelectField opciones={[{ value: 7, label: 'Ana' }]} value={[]} onChange={alCambiar} placeholder="Nadie" />)
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByLabelText('Ana'))
    expect(alCambiar).toHaveBeenCalledWith([7])
  })

  it('avisa cuando no hay opciones', async () => {
    render(<MultiSelectField opciones={[]} value={[]} onChange={() => {}} />)
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Sin opciones')).toBeInTheDocument()
  })
})

describe('ComboField', () => {
  it('permite escribir un valor nuevo y ofrece sugerencias', async () => {
    const alCambiar = vi.fn()
    const { container } = render(
      <ComboField label="Cliente" opciones={['AIR-E', 'AFINIA']} value="" onChange={alCambiar} />,
    )
    await userEvent.type(screen.getByLabelText('Cliente'), 'N')
    expect(alCambiar).toHaveBeenCalledWith('N')
    expect(container.querySelectorAll('datalist option')).toHaveLength(2)
  })
})

function Controlado({ inicial, componente: Componente, alCambiar, ...props }) {
  const [valor, setValor] = useState(inicial)
  return (
    <Componente
      {...props}
      value={valor}
      onChange={(nuevo) => {
        setValor(nuevo)
        alCambiar(nuevo)
      }}
    />
  )
}

describe('DateField', () => {
  it('devuelve ISO y null cuando se borra', async () => {
    const alCambiar = vi.fn()
    render(<Controlado componente={DateField} label="Inicio" inicial={null} alCambiar={alCambiar} />)
    const campo = screen.getByLabelText('Inicio')
    await userEvent.type(campo, '2026-03-05')
    expect(alCambiar).toHaveBeenLastCalledWith('2026-03-05')
    await userEvent.clear(campo)
    expect(alCambiar).toHaveBeenLastCalledWith(null)
  })

  it('soporta tipo time', () => {
    render(<DateField label="Hora" tipo="time" value="09:30" onChange={() => {}} />)
    expect(screen.getByLabelText('Hora')).toHaveAttribute('type', 'time')
    expect(screen.getByLabelText('Hora')).toHaveValue('09:30')
  })
})

describe('NumberField', () => {
  it('devuelve número o null si queda vacío', async () => {
    const alCambiar = vi.fn()
    render(<Controlado componente={NumberField} label="Duración" inicial={60} alCambiar={alCambiar} />)
    const campo = screen.getByLabelText('Duración')
    await userEvent.clear(campo)
    expect(alCambiar).toHaveBeenLastCalledWith(null)
    await userEvent.type(campo, '5')
    expect(alCambiar).toHaveBeenLastCalledWith(5)
  })
})

describe('Toggle', () => {
  it('alterna el valor y refleja aria-checked', async () => {
    const alCambiar = vi.fn()
    render(<Toggle label="Activo" checked={false} onChange={alCambiar} />)
    const interruptor = screen.getByRole('switch', { name: 'Activo' })
    expect(interruptor).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(interruptor)
    expect(alCambiar).toHaveBeenCalledWith(true)
  })

  it('deshabilitado no cambia', async () => {
    const alCambiar = vi.fn()
    render(<Toggle label="Activo" checked disabled onChange={alCambiar} />)
    await userEvent.click(screen.getByRole('switch'))
    expect(alCambiar).not.toHaveBeenCalled()
  })
})

describe('SegmentedControl', () => {
  it('marca la opción activa y notifica el cambio', async () => {
    const alCambiar = vi.fn()
    render(<SegmentedControl opciones={[{ value: 'equipo', label: 'Equipo' }, { value: 'stakeholder', label: 'Stakeholders' }]} value="equipo" onChange={alCambiar} />)
    expect(screen.getByRole('button', { name: 'Equipo' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Stakeholders' }))
    expect(alCambiar).toHaveBeenCalledWith('stakeholder')
  })
})

describe('PillsSelect', () => {
  it('modo múltiple agrega y quita', async () => {
    const alCambiar = vi.fn()
    const { rerender } = render(<PillsSelect opciones={['A', 'B']} value={['A']} onChange={alCambiar} />)
    await userEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(alCambiar).toHaveBeenLastCalledWith(['A', 'B'])
    rerender(<PillsSelect opciones={['A', 'B']} value={['A']} onChange={alCambiar} />)
    await userEvent.click(screen.getByRole('button', { name: 'A' }))
    expect(alCambiar).toHaveBeenLastCalledWith([])
  })

  it('modo simple devuelve el valor elegido', async () => {
    const alCambiar = vi.fn()
    render(<PillsSelect multiple={false} opciones={['A', 'B']} value="A" onChange={alCambiar} />)
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(alCambiar).toHaveBeenCalledWith('B')
  })
})
