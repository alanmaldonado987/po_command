import { MultiSelectField, SelectField, Toggle, Toolbar } from '../../components/ui'
import { valoresUnicos } from '../../lib/texto'

export function FiltrosCronograma({ clientes, itemsDelCliente, filtros, alCambiar }) {
  return (
    <Toolbar>
      <SelectField
        className="min-w-[180px] flex-1"
        label="Cliente"
        opciones={clientes}
        value={filtros.cliente}
        onChange={(cliente) => alCambiar({ cliente, actividades: [], responsables: [] })}
      />
      <MultiSelectField
        className="min-w-[200px] flex-[1.2]"
        label="Actividad"
        opciones={valoresUnicos(itemsDelCliente, 'actividad')}
        value={filtros.actividades}
        onChange={(actividades) => alCambiar({ actividades })}
        placeholder="Todas"
      />
      <MultiSelectField
        className="min-w-[200px] flex-[1.2]"
        label="Responsable"
        opciones={valoresUnicos(itemsDelCliente, 'responsable')}
        value={filtros.responsables}
        onChange={(responsables) => alCambiar({ responsables })}
        placeholder="Todos"
      />
      <Toggle
        label="Solo abiertos"
        checked={filtros.soloAbiertos}
        onChange={(soloAbiertos) => alCambiar({ soloAbiertos })}
        className="pb-2"
      />
    </Toolbar>
  )
}
