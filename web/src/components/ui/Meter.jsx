export function Meter({ porcentaje, color = '#0369A1' }) {
  return (
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line-soft">
      <i className="block h-full rounded-full" style={{ width: `${Math.min(porcentaje, 100)}%`, background: color }} />
    </div>
  )
}
