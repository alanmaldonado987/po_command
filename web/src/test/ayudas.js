export const argumentoDe = (mock, indiceLlamada = 0, indiceArgumento = 0) => mock.mock.calls[indiceLlamada][indiceArgumento]

export const ultimoArgumentoDe = (mock, indiceArgumento = 0) => mock.mock.calls.at(-1)[indiceArgumento]
