import { useState } from 'react'
import { useToast } from '../../context/ToastContext'
import { CATALOGOS } from '../../lib/constantes'
import { useActualizarRegistro, useCatalogo, useCrearRegistro, useEliminarRegistro } from '../../hooks/useCatalogos'
import { useItems } from '../../hooks/useItems'
import { ErrorState, LoadingState, SegmentedControl } from '../../components/ui'
import { contarUsos, mensajeDeError } from './catalogos'
import { FilaCatalogo } from './FilaCatalogo'

export function PestanaCatalogos() {
  const [tabla, setTabla] = useState('cliente')
  const { data: registros = [], isLoading, error } = useCatalogo(tabla)
  const { data: productos = [] } = useCatalogo('producto')
  const { data: items = [] } = useItems()
  const crear = useCrearRegistro()
  const actualizar = useActualizarRegistro()
  const eliminar = useEliminarRegistro()
  const toast = useToast()
  const usos = contarUsos(items, tabla)

  const ejecutar = async (accion, mensaje) => {
    try {
      await accion()
      toast(mensaje)
      return true
    } catch (fallo) {
      toast(mensajeDeError(fallo), 'error')
      return false
    }
  }

  const guardar = (datos, id) =>
    id
      ? ejecutar(() => actualizar.mutateAsync({ tabla, id, datos }), 'Cambios guardados.')
      : ejecutar(() => crear.mutateAsync({ tabla, datos }), 'Registro agregado.')

  const borrar = (id) => ejecutar(() => eliminar.mutateAsync({ tabla, id }), 'Registro eliminado.')

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-ink-muted">
        Estos son los términos que usan el backlog, los filtros y las alertas. Renombrar aquí corrige todos los ítems a la vez. Borrar
        un registro deja sin ese dato a los ítems que lo usaban.
      </p>
      <SegmentedControl label="Catálogo" opciones={Object.entries(CATALOGOS).map(([value, label]) => ({ value, label }))} value={tabla} onChange={setTabla} />
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} />}
      <div key={tabla} className="space-y-2">
        <FilaCatalogo tabla={tabla} registro={null} productos={productos} alGuardar={guardar} />
        {registros.map((registro) => (
          <FilaCatalogo
            key={`${registro.id}-${registro.nombre}`}
            tabla={tabla}
            registro={registro}
            productos={productos}
            usos={usos[registro.id] ?? 0}
            alGuardar={guardar}
            alEliminar={borrar}
          />
        ))}
      </div>
    </div>
  )
}
