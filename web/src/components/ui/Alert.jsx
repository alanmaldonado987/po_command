import { cx } from '../../lib/cx'
import { Icon } from './Icon'

const TONOS = {
  exito: { clases: 'border-emerald-200 bg-success-soft text-success-ink', icono: 'check_circle' },
  info: { clases: 'border-sky-200 bg-brand-soft text-brand-dark', icono: 'info' },
  aviso: { clases: 'border-amber-200 bg-warning-soft text-warning-ink', icono: 'warning' },
  error: { clases: 'border-red-200 bg-danger-soft text-danger-ink', icono: 'error' },
}

export function Alert({ tono = 'info', icono, className, children }) {
  const { clases, icono: iconoBase } = TONOS[tono]
  return (
    <div role="alert" className={cx('flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm', clases, className)}>
      <Icon name={icono ?? iconoBase} className="mt-px flex-none" />
      <div className="min-w-0 flex-1 leading-snug">{children}</div>
    </div>
  )
}
