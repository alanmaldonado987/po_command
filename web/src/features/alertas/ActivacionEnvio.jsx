import { useState } from 'react'
import { conAviso } from '../../lib/conAviso'
import { correoValido } from '../../lib/texto'
import { useToast } from '../../context/ToastContext'
import { useCambiarModoEnvio, useEnviarCorreoPrueba } from '../../hooks/useCorreo'
import { Alert, Button, TextField } from '../../components/ui'
import { ResultadoCorreo } from './ResultadoCorreo'

const DOMINIO_EJEMPLO = '@empresa.co'
const MAXIMO_NOMBRES = 5

function AvisosDirectorio({ personas }) {
  const activas = personas.filter((p) => p.activo)
  const ejemplo = activas.filter((p) => p.correo.toLowerCase().endsWith(DOMINIO_EJEMPLO))
  const sinCorreo = activas.filter((p) => !correoValido(p.correo))
  return (
    <>
      {ejemplo.length > 0 && (
        <Alert tono="aviso">
          {ejemplo.length} persona(s) tienen el correo de ejemplo {DOMINIO_EJEMPLO} (
          {ejemplo.slice(0, MAXIMO_NOMBRES).map((p) => p.nombre).join(', ')}
          {ejemplo.length > MAXIMO_NOMBRES ? '…' : ''}). Cámbialos en Equipo & Stakeholders antes de activar, o esos
          envíos fallarán.
        </Alert>
      )}
      {sinCorreo.length > 0 && (
        <p className="text-xs text-ink-muted">{sinCorreo.length} persona(s) sin correo: sus alertas te llegarán a ti.</p>
      )}
    </>
  )
}

export function ActivacionEnvio({ config, personas, correoInicial }) {
  const notificar = useToast()
  const prueba = useEnviarCorreoPrueba()
  const cambiarModo = useCambiarModoEnvio()
  const [destino, setDestino] = useState(correoInicial)
  const [resultado, setResultado] = useState(null)
  const [pruebaExitosa, setPruebaExitosa] = useState(false)
  const [confirmado, setConfirmado] = useState(false)

  const enviarPrueba = async () => {
    try {
      const respuesta = await prueba.mutateAsync(destino)
      setResultado(respuesta)
      if (respuesta.ok) setPruebaExitosa(true)
    } catch (fallo) {
      setResultado({ ok: false, explicacion: 'No se pudo enviar el correo de prueba.', detalle: fallo.message })
    }
  }

  const cambiar = conAviso(notificar, async (dryRun, mensaje) => {
    await cambiarModo.mutateAsync(dryRun)
    setConfirmado(false)
    notificar(mensaje)
  })

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr]">
        <TextField label="Enviar un correo de prueba real a" icono="mail" value={destino} onChange={setDestino} />
        <Button icon="send" loading={prueba.isPending} onClick={enviarPrueba}>
          Enviar prueba
        </Button>
      </div>
      <ResultadoCorreo resultado={resultado} sufijoExito=". Revisa tu bandeja (y la carpeta de correo no deseado)." />
      {config.dry_run ? (
        <>
          <AvisosDirectorio personas={personas} />
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-brand"
              checked={confirmado}
              disabled={!pruebaExitosa}
              onChange={(evento) => setConfirmado(evento.target.checked)}
            />
            Entiendo que desde ahora las alertas salen por correo a las personas del directorio
          </label>
          <Button
            variant="primary"
            icon="outgoing_mail"
            disabled={!confirmado}
            loading={cambiarModo.isPending}
            onClick={() => cambiar(false, 'Envío real activado: las próximas alertas saldrán por correo.')}
          >
            Activar envío real
          </Button>
          {!pruebaExitosa && (
            <p className="text-xs text-ink-muted">El botón se habilita después de un correo de prueba exitoso.</p>
          )}
        </>
      ) : (
        <Button
          icon="science"
          loading={cambiarModo.isPending}
          onClick={() => cambiar(true, 'Modo simulación activado: no saldrán correos reales.')}
        >
          Volver a modo simulación
        </Button>
      )}
    </div>
  )
}
