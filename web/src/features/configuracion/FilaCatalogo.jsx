import { useState } from 'react'
import { ESTADOS_CATALOGO } from '../../lib/constantes'
import { Button, Chip, SelectField, TextField } from '../../components/ui'
import { aBorrador, aDatosCatalogo, CAMPOS_EXTRA } from './catalogos'

function ConfirmarEliminacion({ usos, alConfirmar, alCancelar }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-danger-ink">
      <span>
        {usos > 0 ? `${usos} ítem(s) quedarán sin este dato. ` : ''}¿Eliminar?
      </span>
      <Button variant="danger" size="sm" onClick={alConfirmar}>
        Sí
      </Button>
      <Button size="sm" onClick={alCancelar}>
        No
      </Button>
    </div>
  )
}

export function FilaCatalogo({ tabla, registro, productos, usos = 0, alGuardar, alEliminar }) {
  const [borrador, setBorrador] = useState(() => aBorrador(registro))
  const [confirmando, setConfirmando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const extras = CAMPOS_EXTRA[tabla]
  const cambiar = (campo) => (valor) => setBorrador((actual) => ({ ...actual, [campo]: valor }))

  const original = aBorrador(registro)
  const modificada = !registro || ['nombre', 'descripcion', ...extras].some((campo) => borrador[campo] !== original[campo])
  const guardable = modificada && borrador.nombre.trim() !== ''

  const guardar = async () => {
    setGuardando(true)
    const guardado = await alGuardar(aDatosCatalogo(tabla, borrador), registro?.id)
    setGuardando(false)
    if (guardado && !registro) setBorrador(aBorrador(null))
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-3">
      <TextField
        className="min-w-[180px] flex-[2]"
        label="Nombre"
        value={borrador.nombre}
        onChange={cambiar('nombre')}
        placeholder={registro ? undefined : 'Nuevo registro'}
      />
      <TextField className="min-w-[200px] flex-[3]" label="Descripción" value={borrador.descripcion} onChange={cambiar('descripcion')} />
      {extras.includes('estado') && (
        <SelectField className="min-w-[130px] flex-1" label="Estado" opciones={ESTADOS_CATALOGO} value={borrador.estado} onChange={cambiar('estado')} />
      )}
      {extras.includes('producto_id') && (
        <SelectField
          className="min-w-[150px] flex-1"
          label="Producto"
          opciones={productos.map((producto) => ({ value: producto.id, label: producto.nombre }))}
          value={borrador.producto_id}
          onChange={cambiar('producto_id')}
          placeholder="Sin producto"
        />
      )}
      <div className="flex min-h-[40px] flex-wrap items-center gap-2">
        {registro && <Chip tono="gris">{usos} ítems</Chip>}
        {confirmando ? (
          <ConfirmarEliminacion usos={usos} alConfirmar={() => alEliminar(registro.id)} alCancelar={() => setConfirmando(false)} />
        ) : (
          <>
            <Button variant="primary" size="sm" icon={registro ? 'save' : 'add'} disabled={!guardable} loading={guardando} onClick={guardar}>
              {registro ? 'Guardar' : 'Agregar'}
            </Button>
            {registro && (
              <Button variant="ghost" size="sm" icon="delete" aria-label={`Eliminar ${registro.nombre}`} onClick={() => setConfirmando(true)} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
