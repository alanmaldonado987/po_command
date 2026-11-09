import { estaAbierto } from '../../lib/dominio'
import { useBloqueantesAbiertos, useItems } from '../../hooks/useItems'
import { useConteoAlertas } from '../../hooks/useAlertas'
import { useConfigCorreo } from '../../hooks/useCorreo'
import { Chip } from '../ui'

function Dato({ etiqueta, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg bg-canvas px-2 py-2 text-center">
      <span className="flex min-h-[24px] items-center text-lg font-extrabold leading-none text-ink">{children}</span>
      <span className="text-[11px] font-medium leading-tight text-ink-muted">{etiqueta}</span>
    </div>
  )
}

function estadoCorreo(config) {
  if (!config) return ['…', 'gris']
  if (config.dry_run) return ['Simulación', 'ambar']
  return config.configurado ? ['Activo', 'verde'] : ['Sin configurar', 'rojo']
}

export function ResumenLateral() {
  const { data: items = [] } = useItems()
  const { data: bloqueantes = [] } = useBloqueantesAbiertos()
  const { data: conteo } = useConteoAlertas()
  const { data: correo } = useConfigCorreo()

  const abiertos = items.filter(estaAbierto)
  const atrasados = abiertos.filter((item) => item.atrasado).length
  const [textoCorreo, tonoCorreo] = estadoCorreo(correo)

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-white p-3 text-center">
      <div className="grid w-full grid-cols-2 gap-2">
        <Dato etiqueta="Ítems abiertos">{abiertos.length}</Dato>
        <Dato etiqueta="Atrasados">
          <Chip tono={atrasados ? 'ambar' : 'verde'} className="text-sm">
            {atrasados}
          </Chip>
        </Dato>
        <Dato etiqueta="Bloqueantes">
          <Chip tono={bloqueantes.length ? 'rojo' : 'verde'} className="text-sm">
            {bloqueantes.length}
          </Chip>
        </Dato>
        <Dato etiqueta="Alertas en cola">{conteo?.pendientes ?? 0}</Dato>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[11px] font-medium text-ink-muted">Correo</span>
        <Chip tono={tonoCorreo}>{textoCorreo}</Chip>
      </div>
      <p className="text-xs text-ink-muted">Plan de Trabajo · {items.length} ítems</p>
    </div>
  )
}
