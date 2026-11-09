import { cx } from '../../lib/cx'
import { Icon } from '../ui'
import { CLASES_MENU } from './clasesMenu'

export function SeccionNavegacion({ titulo, abierta, alAlternar, children }) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={abierta}
        onClick={alAlternar}
        className={cx(
          'flex items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-ink-muted',
          'transition-colors hover:bg-line-soft hover:text-ink-soft',
          CLASES_MENU.ocultar,
        )}
      >
        {titulo}
        <Icon name="expand_more" className={cx('text-[18px] transition-transform duration-300', !abierta && '-rotate-90')} />
      </button>
      <hr className={cx('mx-2 my-1 hidden border-line', CLASES_MENU.mostrarBloque)} />
      <div
        className={cx(
          'grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-in-out',
          abierta ? 'visible grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0',
          CLASES_MENU.abrirSiempre,
        )}
      >
        <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
