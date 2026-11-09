import { useState } from 'react'
import { conAviso } from '../../lib/conAviso'
import { ICONO_REGLA, ROLES_DESTINATARIO, UNIDAD_REGLA } from '../../lib/constantes'
import { useToast } from '../../context/ToastContext'
import { useActualizarRegla } from '../../hooks/useAlertas'
import { Button, Chip, Icon, NumberField, PillsSelect, Popover, TextField, Toggle } from '../../components/ui'

const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/
const HORA_POR_DEFECTO = '08:00'

function AjusteRegla({ regla, cerrar }) {
  const notificar = useToast()
  const actualizar = useActualizarRegla()
  const [destinatarios, setDestinatarios] = useState(regla.destinatarios)
  const [parametro, setParametro] = useState(Number(regla.parametro))
  const [hora, setHora] = useState(regla.hora_envio)
  const unidad = UNIDAD_REGLA[regla.codigo]

  const guardar = conAviso(notificar, async (evento) => {
    evento.preventDefault()
    await actualizar.mutateAsync({
      id: regla.id,
      cambios: {
        destinatarios,
        parametro: parametro ?? 0,
        hora_envio: HORA_VALIDA.test(hora) ? hora : HORA_POR_DEFECTO,
      },
    })
    notificar(`Regla «${regla.nombre}» actualizada.`)
    cerrar()
  })

  return (
    <form onSubmit={guardar} className="w-[min(320px,80vw)] space-y-3">
      <PillsSelect
        label="Para"
        opciones={Object.entries(ROLES_DESTINATARIO).map(([value, label]) => ({ value, label }))}
        value={destinatarios}
        onChange={setDestinatarios}
      />
      <NumberField label={`Parámetro (${unidad ?? 'no aplica'})`} step={1} value={parametro} onChange={setParametro} />
      <TextField label="Hora de envío (HH:MM)" value={hora} onChange={setHora} />
      <Button type="submit" variant="primary" full loading={actualizar.isPending}>
        Guardar
      </Button>
    </form>
  )
}

export function TarjetaRegla({ regla }) {
  const notificar = useToast()
  const actualizar = useActualizarRegla()
  const cambiarActiva = conAviso(notificar, (activa) => actualizar.mutateAsync({ id: regla.id, cambios: { activa } }))
  const unidad = UNIDAD_REGLA[regla.codigo]
  const cuando = unidad ? ` · ${Number(regla.parametro)} ${unidad}` : ''
  const hora = regla.hora_envio !== '00:00' ? ` · ${regla.hora_envio}` : ''

  return (
    <article className="flex flex-col gap-2 rounded-card border border-line bg-white px-5 py-[18px] shadow-card">
      <header className="flex items-center justify-between gap-3">
        <h5 className="flex items-center gap-1.5 text-base font-bold text-ink">
          <Icon name={ICONO_REGLA[regla.codigo] ?? 'notifications'} className="text-ink-muted" />
          {regla.nombre}
        </h5>
        <Toggle label="Activa" checked={regla.activa} onChange={cambiarActiva} />
      </header>
      <p className="text-[13px] text-ink-soft">{regla.descripcion}</p>
      <p className="text-xs text-ink-muted">
        Categoría <b className="text-ink">{regla.categoria}</b>
        {cuando}
        {hora}
      </p>
      <div className="flex flex-wrap gap-1">
        {regla.destinatarios.map((rol) => (
          <Chip key={rol} tono={regla.activa ? 'verde' : 'gris'}>
            {ROLES_DESTINATARIO[rol] ?? rol}
          </Chip>
        ))}
      </div>
      <Popover
        renderTrigger={({ alternar }) => (
          <Button icon="tune" full onClick={alternar}>
            Ajustar
          </Button>
        )}
      >
        {({ cerrar }) => <AjusteRegla regla={regla} cerrar={cerrar} />}
      </Popover>
    </article>
  )
}
