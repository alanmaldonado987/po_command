import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../context/ToastContext'

export function renderizar(interfaz, { ruta = '/' } = {}) {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  })
  const resultado = render(
    <QueryClientProvider client={cliente}>
      <ToastProvider>
        <MemoryRouter initialEntries={[ruta]}>{interfaz}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { cliente, ...resultado }
}
