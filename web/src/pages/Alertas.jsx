import { ColaEnvios } from '../features/alertas/ColaEnvios'
import { HistorialAlertas } from '../features/alertas/HistorialAlertas'
import { KpisAlertas } from '../features/alertas/KpisAlertas'
import { TarjetaCorreo } from '../features/alertas/TarjetaCorreo'
import { TarjetaRegla } from '../features/alertas/TarjetaRegla'
import { Button, ErrorState, Hero, Icon, LoadingState, Toolbar } from '../components/ui'
import { useToast } from '../context/ToastContext'
import { conAviso } from '../lib/conAviso'
import { useConteoAlertas, useReglas, useRevisarReglas } from '../hooks/useAlertas'
import { useConfigCorreo } from '../hooks/useCorreo'
import { useConfiguracion } from '../hooks/useConfiguracion'
import { usePersonas } from '../hooks/usePersonas'

function insigniaCorreo(config) {
  if (config.dry_run) return ['Correo en simulación', 'oscuro']
  return [config.configurado ? 'SMTP activo' : 'SMTP sin configurar', 'oscuro']
}

export default function Alertas() {
  const notificar = useToast()
  const correo = useConfigCorreo()
  const reglas = useReglas()
  const conteo = useConteoAlertas()
  const personas = usePersonas()
  const configuracion = useConfiguracion()
  const revisar = useRevisarReglas()

  const consultas = [correo, reglas, personas, configuracion]
  const error = consultas.find((consulta) => consulta.error)?.error
  if (error) return <ErrorState error={error} />
  if (consultas.some((consulta) => !consulta.data)) return <LoadingState />

  const revisarAhora = conAviso(notificar, async () => {
    const { creadas, enviadas, fallidas } = await revisar.mutateAsync()
    notificar(`Revisión completa: ${creadas} alerta(s) nuevas, ${enviadas} enviada(s), ${fallidas} fallida(s).`)
  })

  return (
    <>
      <Hero
        kicker="ALERTAS & NOTIFICACIONES"
        titulo="Reglas de alerta"
        subtitulo="Define qué evento dispara un aviso, a quién le llega y cuándo. Los envíos salen por correo a tu equipo y stakeholders."
        insignias={[insigniaCorreo(correo.data)]}
      />
      <TarjetaCorreo config={correo.data} personas={personas.data} correoPo={configuracion.data.po_correo ?? ''} />
      <KpisAlertas reglas={reglas.data} conteo={conteo.data} />
      <Toolbar>
        <Button variant="primary" icon="play_arrow" full loading={revisar.isPending} onClick={revisarAhora}>
          Revisar reglas y enviar ahora
        </Button>
      </Toolbar>
      <h5 className="flex items-center gap-1.5 text-base font-bold text-ink">
        <Icon name="rule" className="text-ink-muted" />
        Reglas
      </h5>
      <div className="grid gap-3 md:grid-cols-2">
        {reglas.data.map((regla) => (
          <TarjetaRegla key={regla.id} regla={regla} />
        ))}
      </div>
      <ColaEnvios />
      <HistorialAlertas />
    </>
  )
}
