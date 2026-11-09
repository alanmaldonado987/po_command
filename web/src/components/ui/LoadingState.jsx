import { Icon } from './Icon'

export function LoadingState({ texto = 'Cargando…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted">
      <Icon name="progress_activity" className="animate-spin" />
      {texto}
    </div>
  )
}

export function ErrorState({ error }) {
  return (
    <div className="rounded-xl border border-red-200 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
      No se pudieron cargar los datos: {error?.message ?? 'error desconocido'}
    </div>
  )
}
