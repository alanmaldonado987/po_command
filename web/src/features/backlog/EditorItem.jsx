import { FormularioItem } from './FormularioItem'
import { PanelAcciones } from './PanelAcciones'
import { PanelAyuda } from './PanelAyuda'
import { PanelBitacora } from './PanelBitacora'
import { PanelClickUp } from './PanelClickUp'
import { PanelDestinatarios } from './PanelDestinatarios'

export function EditorItem({ item, base, alGuardar, alCerrar, alDuplicar }) {
  return (
    <div className="grid grid-cols-[3fr_2fr] items-start gap-4 max-lg:grid-cols-1">
      <FormularioItem key={item?.id ?? `nuevo-${base?.id ?? 'vacio'}`} item={item} base={base} alGuardar={alGuardar} alCerrar={alCerrar} />
      <div className="flex flex-col gap-4">
        {item ? (
          <>
            <PanelBitacora itemId={item.id} />
            <PanelDestinatarios itemId={item.id} />
            <PanelClickUp item={item} />
            <PanelAcciones item={item} alDuplicar={alDuplicar} alEliminar={alCerrar} />
          </>
        ) : (
          <PanelAyuda />
        )}
      </div>
    </div>
  )
}
