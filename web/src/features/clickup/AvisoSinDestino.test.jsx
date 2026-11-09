import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AvisoSinDestino } from './AvisoSinDestino'

describe('AvisoSinDestino', () => {
  it('no se muestra sin ítems sin destino', () => {
    const { container } = render(<AvisoSinDestino cantidad={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('tampoco se muestra si la cantidad no llega', () => {
    const { container } = render(<AvisoSinDestino />)
    expect(container).toBeEmptyDOMElement()
  })

  it('indica cuántos ítems no se enviarán y enlaza a los destinos', () => {
    render(<AvisoSinDestino cantidad={7} />)
    expect(screen.getByRole('alert')).toHaveTextContent('7 ítem(s) abiertos no tienen destino en ClickUp')
    expect(screen.getByRole('link', { name: 'Corregir destinos' })).toHaveAttribute('href', '#destinos-clickup')
  })
})
