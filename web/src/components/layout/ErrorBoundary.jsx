import { Component } from 'react'
import { Button } from '../ui'

export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto mt-16 max-w-md space-y-3 rounded-card border border-red-200 bg-danger-soft p-6 text-center">
        <h2 className="text-lg font-bold text-danger-ink">No se pudo mostrar esta página</h2>
        <p className="text-sm text-danger-ink">
          Revisa tu conexión o recarga: puede haberse publicado una versión nueva de la aplicación.
        </p>
        <Button variant="primary" icon="refresh" onClick={() => window.location.reload()}>
          Recargar
        </Button>
      </div>
    )
  }
}
