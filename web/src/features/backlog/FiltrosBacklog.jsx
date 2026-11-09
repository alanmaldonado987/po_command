import { ALCANCES, ESTADOS, FASES, PRIORIDADES, SIN_PRIORIDAD } from '../../lib/constantes'
import { valoresUnicos } from '../../lib/texto'
import { useCatalogo } from '../../hooks/useCatalogos'
import { Button, Expander, MultiSelectField, SelectField, TextField, Toolbar } from '../../components/ui'
import { ORDEN_PLAN, ORDEN_PRIORIDAD } from './useFiltrosBacklog'

const nombres = (catalogo = []) => catalogo.map((registro) => registro.nombre)
const unirOpciones = (existentes, base) => [...new Set([...existentes, ...base])].sort((a, b) => a.localeCompare(b, 'es'))

export function FiltrosBacklog({ filtros, cambiar, items, alNuevo }) {
  const { data: productos } = useCatalogo('producto')
  const { data: clientes } = useCatalogo('cliente')
  const { data: actividades } = useCatalogo('actividad')
  const { data: modulos } = useCatalogo('modulo')

  return (
    <Toolbar className="flex-col items-stretch">
      <div className="grid grid-cols-[2fr_1.4fr_1.4fr_1.5fr_1.6fr_auto] items-end gap-3 max-xl:grid-cols-3 max-md:grid-cols-1">
        <TextField
          label="Buscar"
          icono="search"
          placeholder="Código, funcionalidad o nota"
          value={filtros.texto}
          onChange={cambiar('texto')}
        />
        <MultiSelectField label="Producto" opciones={nombres(productos)} value={filtros.producto} onChange={cambiar('producto')} />
        <MultiSelectField label="Cliente" opciones={nombres(clientes)} value={filtros.cliente} onChange={cambiar('cliente')} />
        <MultiSelectField
          label="Actividad"
          opciones={nombres(actividades)}
          value={filtros.actividad}
          onChange={cambiar('actividad')}
          placeholder="Todas"
        />
        <MultiSelectField
          label="Estado"
          opciones={[...ESTADOS, 'Bloqueado', 'Atrasado']}
          value={filtros.estado}
          onChange={cambiar('estado')}
        />
        <Button variant="primary" icon="add" onClick={alNuevo}>
          Nuevo ítem
        </Button>
      </div>
      <Expander titulo="Más filtros" icono="tune">
        <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <MultiSelectField label="Módulo / componente" opciones={nombres(modulos)} value={filtros.modulo} onChange={cambiar('modulo')} />
          <MultiSelectField
            label="Responsable"
            opciones={valoresUnicos(items, 'responsable')}
            value={filtros.responsable}
            onChange={cambiar('responsable')}
          />
          <MultiSelectField
            label="Alcance"
            opciones={unirOpciones(valoresUnicos(items, 'alcance'), ALCANCES)}
            value={filtros.alcance}
            onChange={cambiar('alcance')}
          />
          <MultiSelectField
            label="Fase"
            opciones={unirOpciones(valoresUnicos(items, 'fase'), FASES)}
            value={filtros.fase}
            onChange={cambiar('fase')}
            placeholder="Todas"
          />
          <MultiSelectField
            label="Prioridad"
            opciones={[...PRIORIDADES, SIN_PRIORIDAD]}
            value={filtros.prioridad}
            onChange={cambiar('prioridad')}
            placeholder="Todas"
          />
          <SelectField
            label="Ordenar por"
            opciones={[ORDEN_PLAN, ORDEN_PRIORIDAD]}
            value={filtros.orden}
            onChange={(valor) => cambiar('orden')(valor ?? ORDEN_PLAN)}
          />
        </div>
      </Expander>
    </Toolbar>
  )
}
