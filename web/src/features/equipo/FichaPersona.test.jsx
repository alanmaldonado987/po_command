import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { crearPersona } from '../../test/fabricas'
import { FichaPersona } from './FichaPersona'

const ficha = (persona) => render(<FichaPersona persona={persona} maximo={1} alEditar={() => {}} />)

describe('FichaPersona · tablero de ClickUp', () => {
  it('muestra el tablero como chip junto al nombre', () => {
    ficha(crearPersona({ nombre: 'Ana Gómez', tablero_id: 1, tablero: 'Analítica' }))
    expect(screen.getByText('Analítica')).toBeInTheDocument()
  })

  it('sin tablero no muestra chip', () => {
    ficha(crearPersona({ nombre: 'Ana Gómez', tablero: null }))
    expect(screen.queryByText('Analítica')).not.toBeInTheDocument()
  })
})
