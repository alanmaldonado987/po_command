import { useCatalogo } from '../../hooks/useCatalogos'
import { useDestinosClickUp, useJerarquiaClickUp, useTablerosClickUp } from '../../hooks/useClickUp'
import { Alert, Card, ErrorState, LoadingState } from '../../components/ui'
import { SeccionDestinos } from './SeccionDestinos'

export function TarjetaDestinos({ equipo }) {
  const { data: jerarquia, isLoading, error } = useJerarquiaClickUp(equipo?.id)
  const { data: destinos = [] } = useDestinosClickUp()
  const { data: tableros = [] } = useTablerosClickUp()
  const { data: clientes = [] } = useCatalogo('cliente')
  const espacios = jerarquia?.espacios ?? []
  const seccion = { clientes, destinos, espacios }

  return (
    <Card
      title="Destinos"
      icon="alt_route"
      subtitle="Dónde se crean en ClickUp los ítems. Se elige por tablero y cliente; si falta un destino se usa el más general disponible: tablero, cliente y por último el destino por defecto."
    >
      {!equipo && <Alert tono="info">Elige un equipo en la tarjeta de conexión para poder configurar los destinos.</Alert>}
      {equipo && isLoading && <LoadingState texto="Leyendo tus espacios de ClickUp…" />}
      {equipo && error && <ErrorState error={error} />}
      {equipo && jerarquia && (
        <div className="space-y-3">
          <SeccionDestinos titulo="Sin tablero / por defecto" icono="inbox" {...seccion} />
          {tableros.map((tablero) => (
            <SeccionDestinos key={tablero.id} titulo={`Tablero ${tablero.nombre}`} icono="dashboard" tablero={tablero} {...seccion} />
          ))}
        </div>
      )}
    </Card>
  )
}
