import { useState } from 'react'
import { conAviso } from '../../lib/conAviso'
import { useToast } from '../../context/ToastContext'
import { useGuardarConfigClickUp, useProbarClickUp } from '../../hooks/useClickUp'
import { Alert, Button, Card, SelectField, TextField, Toggle } from '../../components/ui'

const nombreDeUsuario = (usuario) => (typeof usuario === 'string' ? usuario : (usuario?.username ?? usuario?.email ?? ''))

const TEXTO_CONFIRMACION = {
  true: 'Al activar la sincronización, los ítems nuevos y editados se enviarán a ClickUp y los cambios hechos en ClickUp llegarán a la app.',
  false: 'Al desactivarla, los cambios dejan de sincronizarse en los dos sentidos hasta que la vuelvas a activar.',
}

function FormularioToken({ estado, alProbar }) {
  const toast = useToast()
  const guardar = useGuardarConfigClickUp()
  const probar = useProbarClickUp()
  const [token, setToken] = useState('')
  const [resultado, setResultado] = useState(null)

  const guardarYProbar = conAviso(toast, async (evento) => {
    evento.preventDefault()
    if (token.trim()) await guardar.mutateAsync({ token: token.trim() })
    const prueba = await probar.mutateAsync()
    setResultado(prueba)
    alProbar(prueba)
    setToken('')
  })

  return (
    <form onSubmit={guardarYProbar} className="space-y-3">
      <TextField
        label="Token personal de ClickUp"
        type="password"
        autoComplete="off"
        placeholder={estado.token_configurado ? '•••••••• (guardado)' : 'pk_…'}
        ayuda="Se guarda en el servidor y no vuelve al navegador. Déjalo vacío para conservar el guardado."
        value={token}
        onChange={setToken}
      />
      <Button
        type="submit"
        variant="primary"
        icon="lan"
        loading={guardar.isPending || probar.isPending}
        disabled={!token.trim() && !estado.token_configurado}
      >
        Guardar y probar
      </Button>
      {resultado?.ok && (
        <Alert tono="exito">
          Conexión correcta como {nombreDeUsuario(resultado.usuario)}. Equipos disponibles: {resultado.equipos?.length ?? 0}.
        </Alert>
      )}
      {resultado && !resultado.ok && <Alert tono="error">ClickUp rechazó el token. Revisa que sea un token personal vigente.</Alert>}
    </form>
  )
}

function SelectorEquipo({ estado, equipos }) {
  const toast = useToast()
  const guardar = useGuardarConfigClickUp()
  const opciones = equipos.length ? equipos : estado.equipo ? [estado.equipo] : []

  const elegir = conAviso(toast, async (equipoId) => {
    if (!equipoId) return
    await guardar.mutateAsync({ equipo_id: equipoId })
    toast('Equipo guardado.')
  })

  return (
    <SelectField
      label="Equipo de trabajo"
      placeholder="Elige un equipo"
      opciones={opciones.map(({ id, nombre }) => ({ value: id, label: nombre }))}
      value={estado.equipo?.id ?? null}
      onChange={elegir}
      disabled={!estado.token_configurado}
    />
  )
}

function InterruptorSincronizacion({ estado }) {
  const toast = useToast()
  const guardar = useGuardarConfigClickUp()
  const [pendiente, setPendiente] = useState(null)
  const disponible = estado.token_configurado && Boolean(estado.equipo)

  const confirmar = conAviso(toast, async () => {
    await guardar.mutateAsync({ habilitado: pendiente })
    toast(pendiente ? 'Sincronización activada.' : 'Sincronización desactivada.')
    setPendiente(null)
  })

  return (
    <div className="space-y-2">
      <Toggle label="Sincronización activa" checked={estado.habilitado} disabled={!disponible} onChange={setPendiente} />
      {!disponible && <p className="text-xs text-ink-muted">Guarda el token y elige un equipo para poder activarla.</p>}
      {pendiente !== null && (
        <>
          <Alert tono="aviso">{TEXTO_CONFIRMACION[pendiente]}</Alert>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="primary" loading={guardar.isPending} onClick={confirmar}>
              {pendiente ? 'Sí, activar' : 'Sí, desactivar'}
            </Button>
            <Button onClick={() => setPendiente(null)}>Cancelar</Button>
          </div>
        </>
      )}
    </div>
  )
}

export function TarjetaConexion({ estado }) {
  const [equipos, setEquipos] = useState([])

  return (
    <Card title="Conexión" icon="hub" subtitle="Conecta la app con tu espacio de trabajo de ClickUp.">
      <FormularioToken estado={estado} alProbar={(prueba) => setEquipos(prueba.equipos ?? [])} />
      <SelectorEquipo estado={estado} equipos={equipos} />
      <InterruptorSincronizacion estado={estado} />
    </Card>
  )
}
