import { useState } from 'react'
import { Button, Chip, MultiSelectField, TextField } from '../../components/ui'
import { dividirEstados, hacerPrincipal } from './mapeoEstados'

function ResumenEstados({ estado, lista, alCambiar }) {
  const [principal, ...otros] = lista
  return (
    <div className="mt-1.5 space-y-1.5">
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
        <Chip tono="azul">{principal}</Chip>
        <span>Se envía a ClickUp</span>
      </p>
      {otros.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
          <span>También se aceptan al leer:</span>
          {otros.map((nombre) => (
            <span key={nombre} className="inline-flex items-center gap-1">
              <Chip>{nombre}</Chip>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Hacer principal el estado ${nombre} de ${estado}`}
                onClick={() => alCambiar(hacerPrincipal(lista, nombre))}
              >
                Hacer principal
              </Button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function EscribirEstados({ estado, lista, alCambiar }) {
  const [texto, setTexto] = useState(lista.join(', '))
  return (
    <TextField
      label={estado}
      placeholder="Estados de ClickUp separados por coma"
      value={texto}
      onChange={(valor) => {
        setTexto(valor)
        alCambiar(dividirEstados(valor))
      }}
    />
  )
}

export function SelectorEstados({ estado, disponibles, lista, alCambiar }) {
  const opciones = [...new Set([...disponibles, ...lista])]
  return (
    <div className="min-w-0">
      {disponibles.length > 0 ? (
        <MultiSelectField
          label={estado}
          placeholder="Elige uno o varios estados de ClickUp"
          opciones={opciones}
          value={lista}
          onChange={alCambiar}
          enOrdenDeSeleccion
        />
      ) : (
        <EscribirEstados estado={estado} lista={lista} alCambiar={alCambiar} />
      )}
      {lista.length > 0 && <ResumenEstados estado={estado} lista={lista} alCambiar={alCambiar} />}
    </div>
  )
}
