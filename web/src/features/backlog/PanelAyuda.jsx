import { Card } from '../../components/ui'

export function PanelAyuda() {
  return (
    <Card title="Antes de crear" icon="lightbulb">
      <ul className="list-disc space-y-1.5 pl-5 text-sm">
        <li>
          El <b>código</b> (BL-xxx) se asigna solo.
        </li>
        <li>
          En Cliente, Actividad y Módulo puedes <b>escribir un valor nuevo</b>: se agrega al catálogo.
        </li>
        <li>
          Con <b>fecha fin planificada</b> recibirás avisos de vencimiento; si luego la cambias, queda en la bitácora como
          reprogramación.
        </li>
        <li>
          Si lo marcas <b>bloqueado</b>, se avisa al responsable, a ti y a los stakeholders del cliente.
        </li>
      </ul>
    </Card>
  )
}
