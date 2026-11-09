import { tonoPrioridad } from '../../lib/tonos'
import { Chip, Icon } from '../../components/ui'

export function ChipPrioridad({ prioridad }) {
  if (!prioridad) return null
  return (
    <Chip tono={tonoPrioridad(prioridad)}>
      <Icon name="flag" className="text-[14px]" />
      {prioridad}
    </Chip>
  )
}
