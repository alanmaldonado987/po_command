import { Suspense, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePreferencia } from '../../hooks/usePreferencia'
import { cx } from '../../lib/cx'
import { Icon, LoadingState } from '../ui'
import { ErrorBoundary } from './ErrorBoundary'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const { cerrarSesion } = useAuth()
  const ubicacion = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [compacto, setCompacto] = usePreferencia('po.menu.compacto', false)
  const cerrarMenu = () => setMenuAbierto(false)

  return (
    <div
      className={cx(
        'min-h-screen transition-[padding] duration-300 ease-in-out',
        compacto ? 'lg:pl-[84px]' : 'lg:pl-[280px]',
      )}
    >
      <aside
        data-compacto={compacto}
        className={cx(
          'group/menu fixed inset-y-0 left-0 z-40 w-[280px] overflow-hidden border-r border-line bg-white',
          'transition-[width,transform] duration-300 ease-in-out lg:translate-x-0',
          compacto ? 'lg:w-[84px]' : 'lg:w-[280px]',
          menuAbierto ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar
          alNavegar={cerrarMenu}
          alCerrarSesion={cerrarSesion}
          compacto={compacto}
          alAlternarCompacto={() => setCompacto((valor) => !valor)}
        />
      </aside>
      {menuAbierto && <div className="fixed inset-0 z-30 bg-ink/40 lg:hidden" onClick={cerrarMenu} />}

      <header className="sticky top-0 z-20 flex h-11 items-center bg-canvas/90 px-3 backdrop-blur lg:hidden">
        <button type="button" aria-label="Abrir menú" onClick={() => setMenuAbierto(true)} className="rounded-lg p-1.5 hover:bg-line-soft">
          <Icon name="menu" />
        </button>
      </header>

      <main className="mx-auto flex max-w-[1320px] flex-col gap-4 px-8 pb-16 pt-5 max-lg:px-5 max-sm:px-3">
        <ErrorBoundary key={ubicacion.pathname}>
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}
