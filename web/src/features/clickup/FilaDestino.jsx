import { useState } from 'react'
import { Button, Chip } from '../../components/ui'
import { SelectorLista } from './SelectorLista'

function descripcionDestino(destino, heredado) {
  if (destino) return `Lista actual: ${destino.lista_nombre}`
  if (heredado) return `Se enviará a: ${heredado.lista_nombre}`
  return 'Sin destino configurado'
}

export function FilaDestino({ titulo, destino, heredado, aviso, espacios, ocupado, alGuardar, alQuitar }) {
  const [lista, setLista] = useState(null)

  return (
    <div className="space-y-3 rounded-xl border border-line p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-ink">{titulo}</div>
          <div className="text-xs text-ink-muted">{descripcionDestino(destino, heredado)}</div>
        </div>
        {aviso && <Chip tono={aviso.tono}>{aviso.texto}</Chip>}
      </header>
      <SelectorLista espacios={espacios} contexto={titulo} alElegir={setLista} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          icon="save"
          disabled={!lista}
          loading={ocupado}
          aria-label={`Guardar destino de ${titulo}`}
          onClick={() => alGuardar(lista)}
        >
          Guardar destino
        </Button>
        {destino && (
          <Button size="sm" icon="link_off" aria-label={`Quitar destino de ${titulo}`} onClick={alQuitar}>
            Quitar destino
          </Button>
        )}
      </div>
    </div>
  )
}
