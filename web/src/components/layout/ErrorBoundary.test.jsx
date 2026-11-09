import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

const Roto = () => {
  throw new Error('fallo de carga')
}

describe('ErrorBoundary', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('muestra a sus hijos cuando no hay error', () => {
    render(
      <ErrorBoundary>
        <p>contenido</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('contenido')).toBeInTheDocument()
  })

  it('muestra un aviso con botón de recarga cuando un hijo falla', () => {
    render(
      <ErrorBoundary>
        <Roto />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo mostrar esta página')
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  })
})
