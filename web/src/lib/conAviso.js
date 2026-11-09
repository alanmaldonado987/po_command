export const conAviso = (notificar, accion) => async (...argumentos) => {
  try {
    return await accion(...argumentos)
  } catch (fallo) {
    notificar(fallo.message, 'error')
    return undefined
  }
}
