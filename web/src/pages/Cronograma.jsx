import { useState } from 'react'
import { GanttChart } from '../components/charts/GanttChart'
import { Card, EmptyState, ErrorState, Hero, LoadingState } from '../components/ui'
import { FiltrosCronograma } from '../features/cronograma/FiltrosCronograma'
import { ItemsSinFechas } from '../features/cronograma/ItemsSinFechas'
import { KpisCronograma } from '../features/cronograma/KpisCronograma'
import { LEYENDA_TRAMOS, construirFilasGantt, itemsSinFechas } from '../features/cronograma/tramos'
import { useItems } from '../hooks/useItems'
import { estaAbierto } from '../lib/dominio'
import { hoyIso } from '../lib/fechas'
import { valoresUnicos } from '../lib/texto'

const FILTROS_INICIALES = { cliente: null, actividades: [], responsables: [], soloAbiertos: true }

export default function Cronograma() {
  const { data: todos, isLoading, error } = useItems()
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState error={error} />

  const clientes = valoresUnicos(todos, 'cliente')
  const cliente = filtros.cliente ?? clientes[0]
  const itemsDelCliente = todos.filter((item) => item.cliente === cliente)
  const visibles = itemsDelCliente.filter(
    (item) =>
      (!filtros.actividades.length || filtros.actividades.includes(item.actividad)) &&
      (!filtros.responsables.length || filtros.responsables.includes(item.responsable)) &&
      (!filtros.soloAbiertos || estaAbierto(item)),
  )
  const filasGantt = construirFilasGantt(visibles)
  const sinFechas = itemsSinFechas(visibles)

  return (
    <>
      <Hero
        kicker="CRONOGRAMA"
        titulo="Planificado frente a ejecutado"
        subtitulo="Las barras claras son lo planificado y las oscuras lo ejecutado, para desarrollo/customización y para ajustes (pruebas)."
      />
      {clientes.length === 0 ? (
        <EmptyState>
          Aún no hay ítems con cliente. Créalos en Backlog o importa tu Plan de Trabajo en Configuración & Datos.
        </EmptyState>
      ) : (
        <>
          <FiltrosCronograma
            clientes={clientes}
            itemsDelCliente={itemsDelCliente}
            filtros={{ ...filtros, cliente }}
            alCambiar={(cambios) => setFiltros((actuales) => ({ ...actuales, cliente, ...cambios }))}
          />
          <KpisCronograma cliente={cliente} items={visibles} sinFechas={sinFechas.length} />
          <Card title={`Cronograma · ${cliente}`} icon="date_range">
            {filasGantt.length === 0 ? (
              <EmptyState>Ningún ítem de este filtro tiene fechas.</EmptyState>
            ) : (
              <>
                <GanttChart filas={filasGantt} hoy={hoyIso()} leyenda={LEYENDA_TRAMOS} />
                <p className="text-[13px] text-ink-muted">
                  Pasa el cursor por una barra para ver estado, responsable y días de atraso. La línea roja es hoy.
                </p>
              </>
            )}
          </Card>
          <ItemsSinFechas items={sinFechas} />
        </>
      )}
    </>
  )
}
