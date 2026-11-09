import { correoValido } from '../../lib/texto'
import { tonoPersona } from '../../lib/tonos'
import { Avatar, Button, Chip, Meter } from '../../components/ui'

function ResumenCarga({ carga, maximo }) {
  const { abiertos, atrasados } = carga
  return (
    <>
      <div className="mt-2.5 flex justify-between text-xs text-ink-muted">
        <span>Ítems abiertos</span>
        <b className={atrasados ? 'text-danger-ink' : 'text-ink'}>
          {abiertos}
          {atrasados ? ` · ${atrasados} atrasados` : ''}
        </b>
      </div>
      <Meter porcentaje={(abiertos / maximo) * 100} color={atrasados ? '#D97706' : '#0369A1'} />
    </>
  )
}

export function FichaPersona({ persona, carga = { abiertos: 0, atrasados: 0 }, maximo, alEditar }) {
  const esEquipo = persona.tipo === 'equipo'
  return (
    <article className="flex flex-col rounded-card border border-line bg-white p-[18px] shadow-card">
      <div className="flex items-center gap-3">
        <Avatar nombre={persona.nombre} tono={tonoPersona(persona.tipo)} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-ink">
            {persona.nombre}
            {!persona.activo && <Chip>Inactivo</Chip>}
            {persona.tablero && <Chip tono="violeta">{persona.tablero}</Chip>}
          </div>
          <div className="text-xs text-ink-muted">{persona.rol || '-'}</div>
        </div>
      </div>
      <div className="mt-2.5 break-all text-[13px] text-ink-soft">
        {correoValido(persona.correo) ? persona.correo : <Chip tono="rojo">Falta correo válido</Chip>}
      </div>
      <div className="mt-1 text-xs text-ink-muted">{persona.clientes || 'Sin clientes asignados'}</div>
      {esEquipo ? (
        <ResumenCarga carga={carga} maximo={maximo} />
      ) : (
        <div className="mt-2.5 text-xs text-ink-muted">
          Reporte: <b className="text-ink">{persona.frecuencia_reporte || '-'}</b>
        </div>
      )}
      <div className="mb-2 mt-2.5 flex flex-wrap gap-1">
        {persona.recibe.map((categoria) => (
          <Chip key={categoria}>{categoria}</Chip>
        ))}
      </div>
      <Button icon="edit" full className="mt-auto" onClick={alEditar}>
        Editar
      </Button>
    </article>
  )
}
