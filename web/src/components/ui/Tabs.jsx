import { useState } from 'react'
import { cx } from '../../lib/cx'
import { Icon } from './Icon'

export function Tabs({ pestanas }) {
  const [activa, setActiva] = useState(pestanas[0].id)
  const actual = pestanas.find((pestana) => pestana.id === activa)

  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
        {pestanas.map(({ id, titulo, icono }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={id === activa}
            onClick={() => setActiva(id)}
            className={cx(
              'flex items-center gap-1.5 rounded-t-lg px-3.5 py-2 text-sm font-semibold transition-colors',
              id === activa ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink',
            )}
          >
            {icono && <Icon name={icono} className="text-[18px]" />}
            {titulo}
          </button>
        ))}
      </div>
      <div className="pt-4">{actual.contenido}</div>
    </div>
  )
}
