import { useState } from 'react'
import { PROVEEDORES_CORREO } from '../../lib/constantes'
import { useGuardarConfigCorreo, useProbarConexion } from '../../hooks/useCorreo'
import { Button, Expander, NumberField, SegmentedControl, SelectField, TextField } from '../../components/ui'
import { ResultadoCorreo } from './ResultadoCorreo'

const SEGURIDADES = ['starttls', 'ssl', 'none']
const OTRO = 'Otro servidor'

const proveedorDe = (host) =>
  Object.entries(PROVEEDORES_CORREO).find(([, preset]) => preset?.host === host)?.[0] ?? OTRO

const formularioInicial = (config, correoPo) => ({
  usuario: config.usuario || correoPo,
  password: '',
  remitente: config.remitente || config.usuario || correoPo,
  nombre_remitente: config.nombre_remitente,
  host: config.host,
  puerto: config.puerto,
  seguridad: config.seguridad,
})

export function FormularioSmtp({ config, correoPo }) {
  const guardar = useGuardarConfigCorreo()
  const probar = useProbarConexion()
  const [form, setForm] = useState(() => formularioInicial(config, correoPo))
  const [resultado, setResultado] = useState(null)
  const cambiar = (campo) => (valor) => setForm((actual) => ({ ...actual, [campo]: valor }))

  const elegirProveedor = (nombre) => {
    const preset = PROVEEDORES_CORREO[nombre]
    if (preset) setForm((actual) => ({ ...actual, ...preset }))
  }

  const enviar = async (evento) => {
    evento.preventDefault()
    const { password, ...resto } = form
    const valores = {
      ...resto,
      usuario: resto.usuario.trim(),
      remitente: (resto.remitente || resto.usuario).trim(),
      ...(password && { password }),
    }
    try {
      await guardar.mutateAsync(valores)
      setForm((actual) => ({ ...actual, password: '' }))
      setResultado(await probar.mutateAsync())
    } catch (fallo) {
      setResultado({ ok: false, explicacion: 'No se pudo guardar y probar la configuración.', detalle: fallo.message })
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <SegmentedControl
        label="Proveedor"
        opciones={Object.keys(PROVEEDORES_CORREO)}
        value={proveedorDe(form.host)}
        onChange={elegirProveedor}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Correo de la cuenta" placeholder="tu@ises.com.co" value={form.usuario} onChange={cambiar('usuario')} />
        <TextField
          label="Contraseña o contraseña de aplicación"
          type="password"
          autoComplete="new-password"
          placeholder={config.password_guardada ? '•••••••• (guardada)' : ''}
          ayuda="Si tu cuenta usa verificación en dos pasos, usa una contraseña de aplicación. Déjala vacía para conservar la que ya está guardada."
          value={form.password}
          onChange={cambiar('password')}
        />
        <TextField
          label="Remitente"
          ayuda="Normalmente el mismo correo de la cuenta."
          value={form.remitente}
          onChange={cambiar('remitente')}
        />
        <TextField label="Nombre del remitente" value={form.nombre_remitente} onChange={cambiar('nombre_remitente')} />
      </div>
      <Expander titulo="Servidor (avanzado)">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <TextField label="Servidor SMTP" value={form.host} onChange={cambiar('host')} />
          <NumberField label="Puerto" min={1} max={65535} value={form.puerto} onChange={cambiar('puerto')} />
          <SelectField label="Seguridad" opciones={SEGURIDADES} value={form.seguridad} onChange={cambiar('seguridad')} />
        </div>
      </Expander>
      <Button type="submit" variant="primary" icon="lan" loading={guardar.isPending || probar.isPending}>
        Guardar y probar conexión
      </Button>
      <ResultadoCorreo resultado={resultado} />
    </form>
  )
}
