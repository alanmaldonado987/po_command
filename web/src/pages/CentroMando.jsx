import { ErrorState, Hero, Kpi, KpiGrid, LoadingState } from '../components/ui'
import { ActividadNotificaciones } from '../features/centro/ActividadNotificaciones'
import { AtrasadosPorVencer } from '../features/centro/AtrasadosPorVencer'
import { AvancePorCliente } from '../features/centro/AvancePorCliente'
import { AvisoInicio } from '../features/centro/AvisoInicio'
import { BloqueantesActivos } from '../features/centro/BloqueantesActivos'
import { CargaPorResponsable } from '../features/centro/CargaPorResponsable'
import { EstadoItemsDonut } from '../features/centro/EstadoItemsDonut'
import { ProximasAlertas } from '../features/centro/ProximasAlertas'
import { useConteoAlertas } from '../hooks/useAlertas'
import { useCatalogo } from '../hooks/useCatalogos'
import { useConfigCorreo } from '../hooks/useCorreo'
import { useBloqueantesAbiertos, useItems } from '../hooks/useItems'
import { PALETA } from '../lib/constantes'
import { estaAbierto, porcentajeAvance } from '../lib/dominio'
import { diaSemana, formatoFecha, hoyIso } from '../lib/fechas'

function subtituloHero(bloqueantes, pendientes) {
  const hoy = new Date()
  const dia = diaSemana(hoy)
  return `${dia.charAt(0).toUpperCase() + dia.slice(1)} ${formatoFecha(hoyIso()).slice(0, 5)} · ${bloqueantes} bloqueante(s) requieren tu atención y ${pendientes} alerta(s) esperan en cola.`
}

export default function CentroMando() {
  const items = useItems()
  const bloqueantes = useBloqueantesAbiertos()
  const { data: conteo } = useConteoAlertas()
  const { data: correo } = useConfigCorreo()
  const { data: clientes = [] } = useCatalogo('cliente')

  if (items.isLoading || bloqueantes.isLoading) return <LoadingState />
  if (items.error || bloqueantes.error) return <ErrorState error={items.error ?? bloqueantes.error} />

  const lista = items.data
  const abiertos = lista.filter(estaAbierto)
  const atrasados = abiertos.filter((item) => item.atrasado).length
  const terminados = lista.filter((item) => item.estado === 'Terminado').length
  const enPruebas = lista.filter((item) => item.estado === 'Terminado, en etapa de pruebas').length
  const conAtraso = bloqueantes.data.filter((bloqueante) => bloqueante.severidad === 'Alta').length
  const fallidas = conteo?.fallidas ?? 0

  return (
    <>
      <Hero
        kicker="PO COMMAND CENTER · CONTROL DE ACTIVIDADES"
        titulo="Centro de Mando"
        subtitulo={subtituloHero(bloqueantes.data.length, conteo?.pendientes ?? 0)}
        insignias={[
          ['Base de datos activa', 'oscuro'],
          [correo?.dry_run === false ? 'Correo activo' : 'Correo en simulación', 'oscuro'],
        ]}
      />
      <AvisoInicio />

      <KpiGrid>
        <Kpi
          etiqueta="Clientes"
          valor={clientes.filter((cliente) => cliente.estado === 'Activo').length}
          detalle={`${lista.length} ítems en el plan`}
          color={PALETA.azul}
        />
        <Kpi
          etiqueta="Avance"
          valor={`${porcentajeAvance(lista).toFixed(0)}%`}
          detalle={`${terminados} terminados · ${enPruebas} en pruebas`}
          color={PALETA.verde}
          porcentaje={porcentajeAvance(lista)}
        />
        <Kpi
          etiqueta="Atrasados"
          valor={atrasados}
          detalle={`de ${abiertos.length} ítems abiertos`}
          color={PALETA.ambar}
          colorValor={atrasados ? '#B45309' : undefined}
        />
        <Kpi
          etiqueta="Bloqueantes"
          valor={bloqueantes.data.length}
          detalle={`${conAtraso} con atraso`}
          color={PALETA.rojo}
          colorValor={bloqueantes.data.length ? '#B91C1C' : undefined}
        />
        <Kpi
          etiqueta="Alertas hoy"
          valor={conteo?.enviadasHoy ?? 0}
          detalle={fallidas ? `${fallidas} fallida(s) por revisar` : 'Sin envíos fallidos'}
          color={PALETA.violeta}
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <BloqueantesActivos bloqueantes={bloqueantes.data} />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-5">
          <ProximasAlertas />
          <EstadoItemsDonut items={lista} />
        </div>
      </div>

      <AvancePorCliente items={lista} />

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <AtrasadosPorVencer items={lista} />
        </div>
        <div className="lg:col-span-5">
          <CargaPorResponsable items={lista} />
        </div>
      </div>

      <ActividadNotificaciones />
    </>
  )
}
