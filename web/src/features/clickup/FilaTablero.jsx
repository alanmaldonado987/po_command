import { useState } from 'react'
import { Alert, Button, Chip, TextField } from '../../components/ui'

function ConfirmarBorrado({ tablero, uso, ocupado, alConfirmar, alCancelar }) {
  return (
    <div className="space-y-2">
      <Alert tono="error">
        ¿Eliminar el tablero «{tablero.nombre}»? Lo usan {uso.personas} persona(s) y {uso.destinos} destino(s). Sus
        personas quedarán sin tablero, los destinos del tablero se borran y sus ítems pasarán a usar el destino general.
      </Alert>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="danger" loading={ocupado} onClick={alConfirmar}>
          Sí, eliminar
        </Button>
        <Button onClick={alCancelar}>Cancelar</Button>
      </div>
    </div>
  )
}

export function FilaTablero({ tablero, uso, ocupado, alRenombrar, alEliminar }) {
  const [nombre, setNombre] = useState(tablero.nombre)
  const [confirmando, setConfirmando] = useState(false)
  const cambio = nombre.trim() && nombre.trim() !== tablero.nombre

  return (
    <div className="space-y-3 rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-end gap-3">
        <TextField className="min-w-[200px] flex-1" label="Nombre" aria-label={`Nombre del tablero ${tablero.nombre}`} value={nombre} onChange={setNombre} />
        <Button icon="save" disabled={!cambio} loading={ocupado} aria-label={`Renombrar tablero ${tablero.nombre}`} onClick={() => alRenombrar(nombre.trim())}>
          Renombrar
        </Button>
        <Button icon="delete" aria-label={`Eliminar tablero ${tablero.nombre}`} onClick={() => setConfirmando(true)}>
          Eliminar
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip tono="azul">{uso.personas} persona(s)</Chip>
        <Chip>{uso.destinos} destino(s)</Chip>
        <Chip tono={tablero.mapeo_estados ? 'violeta' : 'gris'}>
          {tablero.mapeo_estados ? 'Mapeo de estados propio' : 'Usa el mapeo general'}
        </Chip>
      </div>
      {confirmando && (
        <ConfirmarBorrado
          tablero={tablero}
          uso={uso}
          ocupado={ocupado}
          alConfirmar={alEliminar}
          alCancelar={() => setConfirmando(false)}
        />
      )}
    </div>
  )
}
