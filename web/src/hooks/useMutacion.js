import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useMutacion(funcion, clavesInvalidar = []) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: funcion,
    onSuccess: () =>
      Promise.all(clavesInvalidar.map((clave) => cliente.invalidateQueries({ queryKey: [clave] }))),
  })
}
