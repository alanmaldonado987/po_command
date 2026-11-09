import { useState } from 'react'
import { EmptyState, ErrorState, Hero, LoadingState, MultiSelectField, Toolbar } from '../components/ui'
import { AlertasPorRegla } from '../features/analitica/AlertasPorRegla'
import { AvanceAgrupado } from '../features/analitica/AvanceAgrupado'
import { KpisAnalitica } from '../features/analitica/KpisAnalitica'
import { ModulosConAtrasos, PorResponsable } from '../features/analitica/PorResponsableYModulo'
import { TablaClienteActividad } from '../features/analitica/TablaClienteActividad'
import { calcularKpis } from '../features/analitica/metricas'
import { useBloqueantes, useItems, useTodasLasNotas } from '../hooks/useItems'
import { valoresUnicos } from '../lib/texto'

export default function Analitica() {
  const items = useItems()
  const notas = useTodasLasNotas()
  const bloqueantes = useBloqueantes()
  const [clientes, setClientes] = useState([])
  const [alcances, setAlcances] = useState([])

  const consultas = [items, notas, bloqueantes]
  if (consultas.some((consulta) => consulta.isLoading)) return <LoadingState />
  const fallida = consultas.find((consulta) => consulta.error)
  if (fallida) return <ErrorState error={fallida.error} />

  const todos = items.data
  const filtrados = todos.filter(
    (item) => (!clientes.length || clientes.includes(item.cliente)) && (!alcances.length || alcances.includes(item.alcance)),
  )

  return (
    <>
      <Hero
        kicker="ANALÍTICA"
        titulo="Cumplimiento del plan de trabajo"
        subtitulo="Avance, entregas a tiempo, reprogramaciones y bloqueos por cliente, calculados desde la base de datos."
      />
      {todos.length === 0 ? (
        <EmptyState>Aún no hay ítems en el backlog.</EmptyState>
      ) : (
        <>
          <Toolbar>
            <MultiSelectField
              className="min-w-[220px] flex-1"
              label="Cliente"
              opciones={valoresUnicos(todos, 'cliente')}
              value={clientes}
              onChange={setClientes}
              placeholder="Todos"
            />
            <MultiSelectField
              className="min-w-[220px] flex-1"
              label="Alcance"
              opciones={valoresUnicos(todos, 'alcance')}
              value={alcances}
              onChange={setAlcances}
              placeholder="Todos"
            />
          </Toolbar>

          {filtrados.length === 0 ? (
            <EmptyState>Ningún ítem coincide con el filtro.</EmptyState>
          ) : (
            <>
              <KpisAnalitica kpis={calcularKpis({ items: filtrados, notas: notas.data, bloqueantes: bloqueantes.data })} />
              <div className="grid gap-4 md:grid-cols-2">
                <AvanceAgrupado titulo="Avance por actividad" icono="stacked_bar_chart" items={filtrados} campo="actividad" sinValor="Sin actividad" />
                <AvanceAgrupado titulo="Avance por alcance" icono="devices" items={filtrados} campo="alcance" sinValor="-" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <PorResponsable items={filtrados} />
                <ModulosConAtrasos items={filtrados} />
              </div>
              <AlertasPorRegla />
              <TablaClienteActividad items={filtrados} />
            </>
          )}
        </>
      )}
    </>
  )
}
