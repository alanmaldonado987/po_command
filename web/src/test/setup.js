import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { cloneElement, createElement } from 'react'
import { afterEach, vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'clave-de-prueba')

vi.mock('recharts', async (importarOriginal) => {
  const original = await importarOriginal()
  const ContenedorFijo = ({ children }) =>
    createElement('div', { style: { width: 800, height: 300 } }, cloneElement(children, { width: 800, height: 300 }))
  return { ...original, ResponsiveContainer: ContenedorFijo }
})

Element.prototype.scrollIntoView = vi.fn()

afterEach(cleanup)
