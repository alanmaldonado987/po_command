import { useMemo, useState } from 'react'
import { Alert, EmptyState, ErrorState, Hero, LoadingState, SegmentedControl, TextField, Toolbar, Button } from '../components/ui'
import { cargaPorPersona, maximoAbiertos } from '../features/equipo/carga'
import { EditorPersona } from '../features/equipo/EditorPersona'
import { FichaPersona } from '../features/equipo/FichaPersona'
import { useCatalogo } from '../hooks/useCatalogos'
import { useTablerosClickUp } from '../hooks/useClickUp'
import { useItems } from '../hooks/useItems'
import { usePersonas } from '../hooks/usePersonas'
import { estaAbierto } from '../lib/dominio'
import { TIPOS_PERSONA } from '../lib/constantes'
import { correoValido } from '../lib/texto'

const NUEVA = 'nueva'

export default function Equipo() {
  const personas = usePersonas()
  const items = useItems()
  const clientes = useCatalogo('cliente')
  const tableros = useTablerosClickUp()
  const [tipo, setTipo] = useState('equipo')
  const [busqueda, setBusqueda] = useState('')
  const [edicion, setEdicion] = useState(null)

  const carga = useMemo(() => cargaPorPersona(items.data ?? []), [items.data])
  const gente = useMemo(() => {
    const texto = busqueda.toLowerCase()
    return (personas.data ?? []).filter(
      (p) => p.tipo === tipo && `${p.nombre} ${p.rol} ${p.clientes} ${p.tablero ?? ''}`.toLowerCase().includes(texto),
    )
  }, [personas.data, tipo, busqueda])

  const error = personas.error ?? items.error ?? clientes.error
  if (error) return <ErrorState error={error} />
  if (!personas.data || !items.data || !clientes.data) return <LoadingState />

  const editada = edicion === NUEVA ? null : personas.data.find((p) => p.id === edicion)
  const sinCorreo = gente.filter((p) => !correoValido(p.correo)).length
  const abiertosDe = (persona) => items.data.filter((i) => i.responsable_id === persona.id && estaAbierto(i)).length

  return (
    <>
      <Hero
        kicker="EQUIPO & STAKEHOLDERS"
        titulo="Directorio y preferencias de aviso"
        subtitulo="Los correos de esta lista son los que usa el motor de alertas para resolver destinatarios."
      />
      <Toolbar>
        <SegmentedControl label="Tipo" opciones={Object.entries(TIPOS_PERSONA).map(([value, label]) => ({ value, label }))} value={tipo} onChange={setTipo} />
        <TextField className="min-w-[200px] flex-1" label="Buscar" icono="search" placeholder="Nombre, rol, cliente o tablero" value={busqueda} onChange={setBusqueda} />
        <Button variant="primary" icon="person_add" onClick={() => setEdicion(NUEVA)}>
          Agregar persona
        </Button>
      </Toolbar>
      {sinCorreo > 0 && (
        <Alert tono="aviso" icono="mail">
          {sinCorreo} persona(s) sin correo válido: sus alertas se redirigen al PO.
        </Alert>
      )}
      {edicion !== null && (editada || edicion === NUEVA) && (
        <EditorPersona
          key={edicion}
          persona={editada}
          tipoInicial={tipo}
          clientes={clientes.data}
          tableros={tableros.data ?? []}
          itemsAbiertos={editada ? abiertosDe(editada) : 0}
          alCerrar={() => setEdicion(null)}
          alGuardar={setEdicion}
        />
      )}
      {gente.length === 0 ? (
        <EmptyState>No hay personas que coincidan.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {gente.map((persona) => (
            <FichaPersona
              key={persona.id}
              persona={persona}
              carga={carga[persona.id]}
              maximo={maximoAbiertos(carga)}
              alEditar={() => setEdicion(persona.id)}
            />
          ))}
        </div>
      )}
    </>
  )
}
