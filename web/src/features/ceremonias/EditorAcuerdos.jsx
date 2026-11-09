import { useState } from 'react'
import { conAviso } from '../../lib/conAviso'
import { ESTADOS_ACUERDO } from '../../lib/constantes'
import { useToast } from '../../context/ToastContext'
import { useEliminarAcuerdo, useGuardarAcuerdo } from '../../hooks/useCeremonias'
import { Button, Card, DateField, EmptyState, SelectField, TextField } from '../../components/ui'

const aFila = (acuerdo) => ({
  clave: String(acuerdo.id),
  id: acuerdo.id,
  descripcion: acuerdo.descripcion,
  origen: acuerdo.origen,
  responsable_id: acuerdo.responsable_id,
  fecha_limite: acuerdo.fecha_limite,
  estado: acuerdo.estado,
})

const filaNueva = () => ({
  clave: crypto.randomUUID(),
  id: null,
  descripcion: '',
  origen: '',
  responsable_id: null,
  fecha_limite: null,
  estado: 'Pendiente',
})

const aDatos = (fila) => ({
  descripcion: fila.descripcion.trim(),
  origen: fila.origen,
  responsable_id: fila.responsable_id,
  fecha_limite: fila.fecha_limite,
  estado: fila.estado,
})

function FilaAcuerdo({ fila, responsables, alCambiar, alQuitar }) {
  return (
    <div className="grid items-end gap-2 rounded-xl border border-line p-3 md:grid-cols-[2fr_1fr_1.2fr_1fr_1fr_auto]">
      <TextField label="Acuerdo" value={fila.descripcion} onChange={(v) => alCambiar('descripcion', v)} />
      <TextField label="Origen" value={fila.origen} onChange={(v) => alCambiar('origen', v)} />
      <SelectField
        label="Responsable"
        placeholder="Sin asignar"
        opciones={responsables}
        value={fila.responsable_id}
        onChange={(v) => alCambiar('responsable_id', v)}
      />
      <DateField label="Fecha límite" value={fila.fecha_limite} onChange={(v) => alCambiar('fecha_limite', v)} />
      <SelectField label="Estado" opciones={ESTADOS_ACUERDO} value={fila.estado} onChange={(v) => alCambiar('estado', v)} />
      <Button icon="delete" aria-label="Quitar acuerdo" onClick={alQuitar} />
    </div>
  )
}

export function EditorAcuerdos({ acuerdos, personas }) {
  const notificar = useToast()
  const guardar = useGuardarAcuerdo()
  const eliminar = useEliminarAcuerdo()
  const [filas, setFilas] = useState(() => acuerdos.map(aFila))
  const [quitados, setQuitados] = useState([])
  const responsables = personas.filter((p) => p.activo).map((p) => ({ value: p.id, label: p.nombre }))

  const cambiar = (clave, campo, valor) =>
    setFilas((actuales) => actuales.map((fila) => (fila.clave === clave ? { ...fila, [campo]: valor } : fila)))

  const quitar = (fila) => {
    setFilas((actuales) => actuales.filter((f) => f.clave !== fila.clave))
    if (fila.id) setQuitados((actuales) => [...actuales, fila.id])
  }

  const guardarTodo = conAviso(notificar, async () => {
    const validas = filas.filter((fila) => fila.descripcion.trim())
    await Promise.all([
      ...quitados.map((id) => eliminar.mutateAsync(id)),
      ...validas.map((fila) => guardar.mutateAsync({ datos: aDatos(fila), id: fila.id })),
    ])
    setQuitados([])
    notificar('Acuerdos guardados.')
  })

  return (
    <Card
      title="Acuerdos y compromisos"
      icon="handshake"
      subtitle="Agrega, edita o borra filas y pulsa Guardar. Un acuerdo vencido sin cumplir avisa al responsable y a ti."
    >
      {filas.length === 0 && <EmptyState>No hay acuerdos registrados.</EmptyState>}
      {filas.map((fila) => (
        <FilaAcuerdo
          key={fila.clave}
          fila={fila}
          responsables={responsables}
          alCambiar={(campo, valor) => cambiar(fila.clave, campo, valor)}
          alQuitar={() => quitar(fila)}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        <Button icon="add" onClick={() => setFilas((actuales) => [...actuales, filaNueva()])}>
          Agregar acuerdo
        </Button>
        <Button variant="primary" icon="save" loading={guardar.isPending || eliminar.isPending} onClick={guardarTodo}>
          Guardar acuerdos
        </Button>
      </div>
    </Card>
  )
}
