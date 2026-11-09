import { useState } from 'react'
import { AUDIENCIAS, TIPOS_CEREMONIA } from '../../lib/constantes'
import { aInputDateTime, desdeInputDateTime, hoyIso } from '../../lib/fechas'
import { useToast } from '../../context/ToastContext'
import { useGuardarCeremonia } from '../../hooks/useCeremonias'
import {
  Alert,
  Button,
  Card,
  DateField,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '../../components/ui'

const HORA_INICIAL = '09:00'

function formularioInicial(ceremonia) {
  const { fecha, hora } = ceremonia ? aInputDateTime(ceremonia.fecha_hora) : { fecha: hoyIso(), hora: HORA_INICIAL }
  return {
    tipo: ceremonia?.tipo ?? TIPOS_CEREMONIA[0],
    titulo: ceremonia?.titulo ?? '',
    fecha,
    hora,
    duracion_min: ceremonia?.duracion_min ?? 60,
    lugar: ceremonia?.lugar ?? 'Teams',
    audiencia: ceremonia?.audiencia ?? 'equipo',
    cliente_id: ceremonia?.cliente_id ?? null,
    notas: ceremonia?.notas ?? '',
  }
}

export function FormularioCeremonia({ ceremonia, clientes, alGuardar, alCerrar }) {
  const notificar = useToast()
  const guardar = useGuardarCeremonia()
  const [form, setForm] = useState(() => formularioInicial(ceremonia))
  const [error, setError] = useState('')
  const cambiar = (campo) => (valor) => setForm((actual) => ({ ...actual, [campo]: valor }))

  const enviar = async (evento) => {
    evento.preventDefault()
    if (!form.titulo.trim()) return setError('El título es obligatorio.')
    setError('')
    const { fecha, hora, ...resto } = form
    try {
      const { id } = await guardar.mutateAsync({
        datos: {
          ...resto,
          titulo: form.titulo.trim(),
          duracion_min: form.duracion_min || 60,
          fecha_hora: desdeInputDateTime(fecha, hora),
        },
        id: ceremonia?.id ?? null,
      })
      notificar('Ceremonia guardada. Los recordatorios se programan automáticamente.')
      alGuardar(id)
    } catch (fallo) {
      setError(fallo.message)
    }
  }

  return (
    <Card title={ceremonia ? 'Editar ceremonia' : 'Nueva ceremonia'} icon="edit_calendar">
      <form onSubmit={enviar} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Tipo" opciones={TIPOS_CEREMONIA} value={form.tipo} onChange={cambiar('tipo')} />
          <TextField label="Título *" value={form.titulo} onChange={cambiar('titulo')} />
          <DateField label="Fecha" value={form.fecha} onChange={cambiar('fecha')} required />
          <DateField label="Hora" tipo="time" value={form.hora} onChange={cambiar('hora')} required />
          <NumberField label="Duración (min)" min={5} max={480} step={5} value={form.duracion_min} onChange={cambiar('duracion_min')} />
          <TextField label="Lugar o enlace" value={form.lugar} onChange={cambiar('lugar')} />
          <SelectField
            label="Invitados"
            opciones={Object.entries(AUDIENCIAS).map(([value, label]) => ({ value, label }))}
            value={form.audiencia}
            onChange={cambiar('audiencia')}
          />
          <SelectField
            label="Cliente"
            placeholder="Todos / general"
            opciones={clientes.map(({ id, nombre }) => ({ value: id, label: nombre }))}
            value={form.cliente_id}
            onChange={cambiar('cliente_id')}
          />
        </div>
        <TextAreaField label="Agenda / preparación" filas={3} value={form.notas} onChange={cambiar('notas')} />
        {error && <Alert tono="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="submit" variant="primary" icon="save" loading={guardar.isPending}>
            Guardar
          </Button>
          <Button icon="close" onClick={alCerrar}>
            Cerrar
          </Button>
        </div>
      </form>
    </Card>
  )
}
