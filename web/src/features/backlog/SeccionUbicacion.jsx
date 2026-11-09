import { useCatalogo } from '../../hooks/useCatalogos'
import { ComboField, TextAreaField, TextField } from '../../components/ui'

const nombres = (catalogo = []) => catalogo.map((registro) => registro.nombre)

export function SeccionUbicacion({ valores, cambiar }) {
  const { data: productos } = useCatalogo('producto')
  const { data: clientes } = useCatalogo('cliente')
  const { data: actividades } = useCatalogo('actividad')
  const { data: modulos } = useCatalogo('modulo')

  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-bold text-ink">Ubicación</legend>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <ComboField
          label="Producto"
          opciones={nombres(productos)}
          value={valores.producto}
          onChange={cambiar('producto')}
          placeholder="Elige o escribe uno nuevo"
        />
        <ComboField
          label="Cliente *"
          opciones={nombres(clientes)}
          value={valores.cliente}
          onChange={cambiar('cliente')}
          placeholder="Elige o escribe uno nuevo"
        />
        <ComboField
          label="Actividad *"
          opciones={nombres(actividades)}
          value={valores.actividad}
          onChange={cambiar('actividad')}
          placeholder="SCR, Cobro, Multifamiliares SCR…"
        />
        <ComboField
          label="Módulo / componente *"
          opciones={nombres(modulos)}
          value={valores.modulo}
          onChange={cambiar('modulo')}
          placeholder="Torre de Control, Órdenes…"
        />
      </div>
      <TextField
        label="Menú / funcionalidad *"
        value={valores.funcionalidad}
        onChange={cambiar('funcionalidad')}
        placeholder="Ej.: Novedades flota vehicular. Escribe «Completo» si es todo el módulo."
      />
      <TextAreaField
        label="Descripción / alcance detallado"
        filas={2}
        value={valores.descripcion}
        onChange={cambiar('descripcion')}
      />
    </fieldset>
  )
}
