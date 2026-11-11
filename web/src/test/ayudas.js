import { screen } from '@testing-library/react'

export const argumentoDe = (mock, indiceLlamada = 0, indiceArgumento = 0) => mock.mock.calls[indiceLlamada][indiceArgumento]

export const ultimoArgumentoDe = (mock, indiceArgumento = 0) => mock.mock.calls.at(-1)[indiceArgumento]

export async function marcarOpcion(usuario, etiquetaCampo, opcion) {
  await usuario.click(screen.getByRole('button', { name: etiquetaCampo }))
  await usuario.click(screen.getByRole('checkbox', { name: opcion }))
  await usuario.keyboard('{Escape}')
}
