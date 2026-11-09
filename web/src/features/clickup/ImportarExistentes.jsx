import { useState } from 'react'
import { conAviso } from '../../lib/conAviso'
import { useToast } from '../../context/ToastContext'
import { useCatalogo } from '../../hooks/useCatalogos'
import { useImportarExistentes, useJerarquiaClickUp, useTablerosClickUp } from '../../hooks/useClickUp'
import { Button, SelectField } from '../../components/ui'
import { aplanarListas } from './jerarquia'

export function ImportarExistentes({ estado }) {
  const toast = useToast()
  const { data: jerarquia } = useJerarquiaClickUp(estado.equipo?.id)
  const { data: clientes = [] } = useCatalogo('cliente')
  const { data: tableros = [] } = useTablerosClickUp()
  const importar = useImportarExistentes()
  const [listaId, setListaId] = useState(null)
  const [clienteId, setClienteId] = useState(null)
  const [tableroId, setTableroId] = useState(null)
  const listas = aplanarListas(jerarquia?.espacios ?? [])

  const ejecutar = conAviso(toast, async () => {
    const { importadas } = await importar.mutateAsync({ listaId, clienteId, tableroId })
    toast(`${importadas} tarea(s) importada(s) desde ClickUp.`)
  })

  return (
    <div className="space-y-3 rounded-xl border border-line p-3">
      <div>
        <div className="text-sm font-bold text-ink">Importar tareas existentes</div>
        <p className="text-xs text-ink-muted">Trae a la app las tareas que ya existen en una lista de ClickUp.</p>
      </div>
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        <SelectField
          label="Lista de ClickUp"
          placeholder="Elige una lista"
          opciones={listas.map(({ id, ruta }) => ({ value: id, label: ruta }))}
          value={listaId}
          onChange={setListaId}
          disabled={!estado.equipo}
        />
        <SelectField
          label="Cliente de los ítems"
          placeholder="Sin cliente"
          opciones={clientes.map(({ id, nombre }) => ({ value: id, label: nombre }))}
          value={clienteId}
          onChange={setClienteId}
        />
        <SelectField
          label="Tablero de la lista"
          placeholder="Sin tablero"
          opciones={tableros.map(({ id, nombre }) => ({ value: id, label: nombre }))}
          value={tableroId}
          onChange={setTableroId}
          disabled={tableros.length === 0}
        />
      </div>
      <Button icon="download" disabled={!listaId || !estado.habilitado} loading={importar.isPending} onClick={ejecutar}>
        Importar tareas
      </Button>
    </div>
  )
}
