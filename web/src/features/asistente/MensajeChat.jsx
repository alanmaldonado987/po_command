import { cx } from '../../lib/cx'
import { Alert, Button, Icon } from '../../components/ui'
import { TextoMarkdown } from './TextoMarkdown'

export function MensajeChat({ mensaje, resultados, alEjecutar, ejecutando }) {
  const esUsuario = mensaje.rol === 'user'
  return (
    <div className={cx('flex gap-3', esUsuario && 'flex-row-reverse')}>
      <span
        className={cx(
          'flex h-8 w-8 flex-none items-center justify-center rounded-full',
          esUsuario ? 'bg-brand-soft text-brand-dark' : 'bg-success-soft text-success-ink',
        )}
      >
        <Icon name={esUsuario ? 'person' : 'auto_awesome'} className="text-[18px]" />
      </span>
      <div className={cx('min-w-0 max-w-[85%] rounded-card border border-line px-4 py-3.5', esUsuario ? 'bg-line-soft' : 'bg-white')}>
        <TextoMarkdown texto={mensaje.contenido} />
        <div className="mt-2 space-y-2 empty:hidden">
          {(mensaje.acciones ?? []).map((accion, indice) => {
            const clave = `${mensaje.id}-${indice}`
            return resultados[clave] ? (
              <Alert key={clave} tono="exito">
                {resultados[clave]}
              </Alert>
            ) : (
              <Button
                key={clave}
                variant="primary"
                icon="task_alt"
                loading={ejecutando === clave}
                disabled={Boolean(ejecutando)}
                onClick={() => alEjecutar(accion, clave)}
              >
                {accion.etiqueta}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
