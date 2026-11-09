import { cx } from '../../lib/cx'
import { iniciales } from '../../lib/texto'
import { CLASES_TONO } from '../../lib/tonos'

export function Avatar({ nombre, tono = 'azul' }) {
  return (
    <span
      className={cx(
        'inline-flex h-9 w-9 flex-none items-center justify-center rounded-full text-xs font-bold',
        CLASES_TONO[tono],
      )}
    >
      {iniciales(nombre)}
    </span>
  )
}
