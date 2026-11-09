import { Icon } from './Icon'

export function Expander({ titulo, icono, abierto = false, children }) {
  return (
    <details open={abierto} className="group rounded-xl border border-line bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-ink-soft [&::-webkit-details-marker]:hidden">
        {icono && <Icon name={icono} className="text-ink-muted" />}
        <span className="flex-1">{titulo}</span>
        <Icon name="expand_more" className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line-soft p-3.5">{children}</div>
    </details>
  )
}
