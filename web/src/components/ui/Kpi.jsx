export function Kpi({ etiqueta, valor, detalle, color, porcentaje, colorValor }) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-white py-3.5 pl-[18px] pr-4 shadow-card max-sm:py-3 max-sm:pl-3.5 max-sm:pr-3">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
      <div className="text-[11px] font-bold uppercase tracking-[.07em] text-ink-muted">{etiqueta}</div>
      <div className="mt-1 text-[clamp(22px,2.4vw,28px)] font-extrabold leading-tight" style={{ color: colorValor ?? '#0F172A' }}>
        {valor}
      </div>
      {detalle !== undefined && <div className="mt-0.5 min-h-[18px] text-xs text-ink-muted">{detalle}</div>}
      {porcentaje !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-soft">
          <i
            className="block h-full rounded-full"
            style={{ width: `${Math.max(0, Math.min(100, porcentaje))}%`, background: color }}
          />
        </div>
      )}
    </div>
  )
}

export function KpiGrid({ minimo = 170, children }) {
  return (
    <div
      className="grid gap-3.5 max-sm:grid-cols-2 max-sm:gap-2.5"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${minimo}px, 100%), 1fr))` }}
    >
      {children}
    </div>
  )
}
