import { useState } from 'react'
import { SelectField } from '../../components/ui'
import { listasDe, opcionesDeCarpeta } from './jerarquia'

const comoOpciones = (elementos) => elementos.map(({ id, nombre }) => ({ value: id, label: nombre }))

export function SelectorLista({ espacios, contexto, alElegir }) {
  const [espacioId, setEspacioId] = useState(null)
  const [carpetaId, setCarpetaId] = useState(null)
  const [listaId, setListaId] = useState(null)
  const espacio = espacios.find((candidato) => candidato.id === espacioId)
  const listas = carpetaId === null ? [] : listasDe(espacio, carpetaId)

  const elegirEspacio = (id) => {
    setEspacioId(id)
    setCarpetaId(null)
    setListaId(null)
    alElegir(null)
  }

  const elegirCarpeta = (id) => {
    setCarpetaId(id)
    setListaId(null)
    alElegir(null)
  }

  const elegirLista = (id) => {
    const lista = listas.find((candidata) => candidata.id === id)
    const carpeta = espacio.carpetas.find((candidata) => candidata.id === carpetaId)
    setListaId(id)
    alElegir(lista ? { ...lista, ruta: [espacio.nombre, carpeta?.nombre, lista.nombre].filter(Boolean).join(' / ') } : null)
  }

  return (
    <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
      <SelectField
        label="Espacio"
        aria-label={`Espacio de ${contexto}`}
        placeholder="Elige un espacio"
        opciones={comoOpciones(espacios)}
        value={espacioId}
        onChange={elegirEspacio}
      />
      <SelectField
        label="Carpeta"
        aria-label={`Carpeta de ${contexto}`}
        placeholder="Elige una carpeta"
        opciones={opcionesDeCarpeta(espacio)}
        value={carpetaId}
        onChange={elegirCarpeta}
        disabled={!espacio}
      />
      <SelectField
        label="Lista"
        aria-label={`Lista de ${contexto}`}
        placeholder="Elige una lista"
        opciones={comoOpciones(listas)}
        value={listaId}
        onChange={elegirLista}
        disabled={carpetaId === null}
      />
    </div>
  )
}
