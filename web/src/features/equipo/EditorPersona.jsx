import { useState } from 'react'
import { CATEGORIAS, FRECUENCIAS_REPORTE } from '../../lib/constantes'
import { conAviso } from '../../lib/conAviso'
import { correoValido } from '../../lib/texto'
import { useToast } from '../../context/ToastContext'
import { useEliminarPersona, useGuardarPersona } from '../../hooks/usePersonas'
import {
  Alert,
  Button,
  Card,
  MultiSelectField,
  PillsSelect,
  SelectField,
  TextField,
  Toggle,
} from '../../components/ui'

const TIPOS = [
  { value: 'equipo', label: 'Equipo' },
  { value: 'stakeholder', label: 'Stakeholder' },
]

const RECIBE_INICIAL = ['Bloqueantes', 'Vencimientos', 'Ceremonias']

const formularioInicial = (persona, tipo) => ({
  nombre: persona?.nombre ?? '',
  correo: persona?.correo ?? '',
  tipo: persona?.tipo ?? tipo,
  rol: persona?.rol ?? '',
  frecuencia_reporte: persona?.frecuencia_reporte ?? '',
  recibe: persona?.recibe ?? RECIBE_INICIAL,
  activo: persona?.activo ?? true,
  clienteIds: persona?.cliente_ids ?? [],
  tablero_id: persona?.tablero_id ?? null,
})

function ConfirmarEliminacion({ persona, abiertos, alConfirmar, alCancelar, cargando }) {
  return (
    <div className="space-y-2">
      <Alert tono="error">
        ¿Eliminar a {persona.nombre}? Dejará de recibir alertas y sus {abiertos} ítem(s) abiertos quedarán sin
        responsable. Si es temporal, mejor desmarca «Activo».
      </Alert>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="danger" loading={cargando} onClick={alConfirmar}>
          Sí, eliminar
        </Button>
        <Button onClick={alCancelar}>Cancelar</Button>
      </div>
    </div>
  )
}

export function EditorPersona({ persona, tipoInicial, clientes, tableros = [], itemsAbiertos, alCerrar, alGuardar }) {
  const notificar = useToast()
  const guardar = useGuardarPersona()
  const eliminar = useEliminarPersona()
  const [form, setForm] = useState(() => formularioInicial(persona, tipoInicial))
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const cambiar = (campo) => (valor) => setForm((actual) => ({ ...actual, [campo]: valor }))

  const enviar = async (evento) => {
    evento.preventDefault()
    if (!form.nombre.trim()) return setError('El nombre es obligatorio.')
    setError('')
    const { clienteIds, ...datos } = form
    try {
      const id = await guardar.mutateAsync({
        datos: {
          ...datos,
          nombre: datos.nombre.trim(),
          correo: datos.correo.trim(),
          tablero_id: datos.tipo === 'equipo' ? datos.tablero_id : null,
        },
        clienteIds,
        id: persona?.id ?? null,
      })
      const aviso = !form.correo || correoValido(form.correo) ? '' : ' Ojo: el correo no parece válido; sus alertas irán al PO.'
      notificar(`${form.nombre} ${persona ? 'actualizado' : 'agregado al directorio'}.${aviso}`)
      alGuardar(id)
    } catch (fallo) {
      setError(fallo.message)
    }
  }

  const borrar = conAviso(notificar, async () => {
    await eliminar.mutateAsync(persona.id)
    notificar(`${persona.nombre} eliminado del directorio.`)
    alCerrar()
  })

  return (
    <Card title={persona ? `Editar a ${persona.nombre}` : 'Nueva persona'} icon="badge">
      <form onSubmit={enviar} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Nombre completo *" value={form.nombre} onChange={cambiar('nombre')} />
          <TextField label="Correo" placeholder="nombre@empresa.co" value={form.correo} onChange={cambiar('correo')} />
          <SelectField label="Tipo" opciones={TIPOS} value={form.tipo} onChange={cambiar('tipo')} />
          <TextField
            label="Rol"
            placeholder="Developer, QA, Líder técnico, Gerente…"
            ayuda="Quien tenga «Líder técnico» en el rol recibe los escalamientos técnicos."
            value={form.rol}
            onChange={cambiar('rol')}
          />
          <SelectField
            label="Frecuencia de reporte (stakeholders)"
            opciones={FRECUENCIAS_REPORTE.map((valor) => ({ value: valor, label: valor || 'Sin definir' }))}
            value={form.frecuencia_reporte}
            onChange={(valor) => cambiar('frecuencia_reporte')(valor ?? '')}
          />
          <MultiSelectField
            label="Clientes"
            placeholder="Ninguno"
            opciones={clientes.map(({ id, nombre }) => ({ value: id, label: nombre }))}
            value={form.clienteIds}
            onChange={cambiar('clienteIds')}
          />
        </div>
        {form.tipo === 'equipo' && (
          <div className="space-y-2">
            <SelectField
              label="Tablero de ClickUp"
              placeholder="Sin tablero"
              opciones={tableros.map(({ id, nombre }) => ({ value: id, label: nombre }))}
              value={form.tablero_id}
              onChange={cambiar('tablero_id')}
            />
            <p className="text-xs text-ink-muted">
              Los tableros se crean en Configuración & Datos → ClickUp. El tablero decide a qué lista van los ítems de
              esta persona.
            </p>
            {persona && form.tablero_id !== (persona.tablero_id ?? null) && (
              <Alert tono="aviso">
                Al cambiar el tablero, los {itemsAbiertos} ítem(s) abiertos de {persona.nombre} se moverán a la lista del
                nuevo tablero en ClickUp.
              </Alert>
            )}
          </div>
        )}
        <PillsSelect label="Recibe alertas de" opciones={CATEGORIAS} value={form.recibe} onChange={cambiar('recibe')} />
        <Toggle label="Activo" checked={form.activo} onChange={cambiar('activo')} />
        {error && <Alert tono="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="submit" variant="primary" icon="save" loading={guardar.isPending}>
            {persona ? 'Guardar cambios' : 'Agregar'}
          </Button>
          <Button icon="close" onClick={alCerrar}>
            Cerrar
          </Button>
        </div>
      </form>
      {persona &&
        (confirmando ? (
          <ConfirmarEliminacion
            persona={persona}
            abiertos={itemsAbiertos}
            cargando={eliminar.isPending}
            alConfirmar={borrar}
            alCancelar={() => setConfirmando(false)}
          />
        ) : (
          <div>
            <Button icon="delete" onClick={() => setConfirmando(true)}>
              Eliminar persona
            </Button>
          </div>
        ))}
    </Card>
  )
}
