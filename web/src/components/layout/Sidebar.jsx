import { NavLink } from 'react-router-dom'
import { usePreferencia } from '../../hooks/usePreferencia'
import { cx } from '../../lib/cx'
import { SECCIONES } from '../../routes'
import { Button, Icon } from '../ui'
import { CLASES_MENU } from './clasesMenu'
import { ResumenLateral } from './ResumenLateral'
import { SeccionNavegacion } from './SeccionNavegacion'

function EnlaceNavegacion({ ruta, titulo, icono, alNavegar }) {
  return (
    <NavLink
      to={ruta}
      end={ruta === '/'}
      title={titulo}
      onClick={alNavegar}
      className={({ isActive }) =>
        cx(
          'flex min-h-[40px] items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-[7px] text-sm transition-colors',
          isActive
            ? 'bg-success-soft font-bold text-success-ink ring-1 ring-inset ring-success-ring'
            : 'font-medium text-ink-soft hover:bg-line-soft',
        )
      }
    >
      <Icon name={icono} className="flex-none" />
      <span className={CLASES_MENU.ocultar}>{titulo}</span>
    </NavLink>
  )
}

export function Sidebar({ alNavegar, alCerrarSesion, compacto, alAlternarCompacto }) {
  const [cerradas, setCerradas] = usePreferencia('po.menu.secciones', {})
  const alternarSeccion = (titulo) => setCerradas((actuales) => ({ ...actuales, [titulo]: !actuales[titulo] }))

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto overflow-x-hidden p-4">
      <div className={cx('flex items-center justify-between gap-2', CLASES_MENU.apilar)}>
        <img src="/logo.png" alt="PO Command Center" className={cx('h-10', CLASES_MENU.ocultar)} />
        <img src="/icono.png" alt="PO Command Center" className={cx('hidden h-9 w-9', CLASES_MENU.mostrarBloque)} />
        <button
          type="button"
          onClick={alAlternarCompacto}
          aria-label={compacto ? 'Expandir menú' : 'Contraer menú'}
          title={compacto ? 'Expandir menú' : 'Contraer menú'}
          className="hidden h-9 w-9 flex-none items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-line-soft hover:text-ink lg:flex"
        >
          <Icon name={compacto ? 'left_panel_open' : 'left_panel_close'} />
        </button>
      </div>

      <nav className="flex flex-col gap-2">
        {SECCIONES.map(({ titulo, rutas }) => (
          <SeccionNavegacion key={titulo} titulo={titulo} abierta={!cerradas[titulo]} alAlternar={() => alternarSeccion(titulo)}>
            {rutas.map((ruta) => (
              <EnlaceNavegacion key={ruta.ruta} {...ruta} alNavegar={alNavegar} />
            ))}
          </SeccionNavegacion>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className={CLASES_MENU.ocultar}>
          <ResumenLateral />
        </div>
        <Button variant="secondary" icon="logout" full onClick={alCerrarSesion} title="Cerrar sesión" aria-label="Cerrar sesión">
          <span className={CLASES_MENU.ocultar}>Cerrar sesión</span>
        </Button>
      </div>
    </div>
  )
}
