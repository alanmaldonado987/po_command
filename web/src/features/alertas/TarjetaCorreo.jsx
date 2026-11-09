import { Card, Chip } from '../../components/ui'
import { ActivacionEnvio } from './ActivacionEnvio'
import { FormularioSmtp } from './FormularioSmtp'

function estadoEnvio(config) {
  if (config.dry_run) return ['Simulación', 'ambar']
  return config.configurado ? ['Envío real activo', 'verde'] : ['Sin configurar', 'rojo']
}

export function TarjetaCorreo({ config, personas, correoPo }) {
  const [texto, tono] = estadoEnvio(config)
  return (
    <Card
      title="Envío de correos"
      icon="mail"
      subtitle="La contraseña se guarda en el servidor (Supabase) y nunca vuelve al navegador."
    >
      <div>
        <Chip tono={tono}>{texto}</Chip>
      </div>
      {config.dry_run && (
        <p className="text-xs text-ink-muted">
          En simulación las alertas se registran pero no sale ningún correo. Completa los datos, prueba y activa el envío
          real.
        </p>
      )}
      <FormularioSmtp config={config} correoPo={correoPo} />
      {config.configurado && (
        <ActivacionEnvio config={config} personas={personas} correoInicial={correoPo || config.usuario} />
      )}
    </Card>
  )
}
