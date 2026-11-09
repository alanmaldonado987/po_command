import { useConfigCorreo } from '../../hooks/useCorreo'
import { Card, Chip } from '../../components/ui'

function estado(config) {
  if (config.dry_run) return ['Simulación', 'ambar']
  return config.configurado ? ['Configurado', 'verde'] : ['Sin configurar', 'rojo']
}

export function TarjetaCorreo() {
  const { data: config } = useConfigCorreo()
  const [texto, tono] = config ? estado(config) : ['…', 'gris']

  return (
    <Card title="Servidor de correo" icon="mail">
      <div>
        <Chip tono={tono}>{texto}</Chip>
      </div>
      {config && (
        <p className="text-[13px] leading-relaxed text-ink-muted">
          {config.host}:{config.puerto} ({config.seguridad})
          <br />
          Remitente: {config.remitente || '-'}
        </p>
      )}
      <p className="text-[13px] text-ink-muted">
        Se configura en Alertas & Notificaciones → Envío de correos (las credenciales no se guardan en el navegador).
      </p>
    </Card>
  )
}
