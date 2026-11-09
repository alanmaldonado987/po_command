import { useState } from 'react'
import { useToast } from '../../context/ToastContext'
import { useConfiguracion } from '../../hooks/useConfiguracion'
import { useNotificarItemGuardado } from '../../hooks/useAlertas'
import { useGuardarItem } from '../../hooks/useItems'
import { Alert, Button, Card } from '../../components/ui'
import { aDatosItem, validar, valoresDeItem, valoresIniciales } from './valoresFormulario'
import { SeccionConsideraciones } from './SeccionConsideraciones'
import { SeccionDetalle } from './SeccionDetalle'
import { CAMPOS_EJECUCION, CAMPOS_PLANIFICACION, SeccionFechas } from './SeccionFechas'
import { SeccionUbicacion } from './SeccionUbicacion'

function tituloFormulario(item, base) {
  if (item) return `Editar ${item.codigo}`
  return base ? `Nuevo ítem (copia de ${base.codigo})` : 'Nuevo ítem del backlog'
}

export function FormularioItem({ item, base, alGuardar, alCerrar }) {
  const [valores, setValores] = useState(() => (item ? valoresDeItem(item) : valoresIniciales(base)))
  const [errores, setErrores] = useState([])
  const { data: config } = useConfiguracion()
  const guardarItem = useGuardarItem()
  const notificar = useNotificarItemGuardado()
  const toast = useToast()

  const cambiar = (campo) => (valor) => setValores((actuales) => ({ ...actuales, [campo]: valor }))

  const guardar = async (evento) => {
    evento.preventDefault()
    const encontrados = validar(valores)
    setErrores(encontrados)
    if (encontrados.length) return

    try {
      const resultado = await guardarItem.mutateAsync({
        datos: aDatosItem(valores),
        id: item?.id ?? null,
        nota: valores.nota,
        tipoNota: valores.tipoNota,
        autor: config?.po_nombre ?? '',
      })
      const aviso = await notificar.mutateAsync(resultado).catch((fallo) => ({ mensaje: `No se pudo avisar: ${fallo.message}` }))
      const cambioFechas = resultado.cambios.length ? ' Cambio de fechas registrado en la bitácora.' : ''
      toast(`${resultado.codigo} guardado en la base de datos.${cambioFechas} ${aviso?.mensaje ?? ''}`.trim())
      alGuardar(resultado.id)
    } catch (fallo) {
      setErrores([fallo.message])
    }
  }

  return (
    <Card title={tituloFormulario(item, base)} icon="edit_note">
      <form onSubmit={guardar} className="space-y-4">
        <SeccionUbicacion valores={valores} cambiar={cambiar} />
        <SeccionDetalle valores={valores} cambiar={cambiar} />
        <SeccionFechas titulo="Planificación" campos={CAMPOS_PLANIFICACION} valores={valores} cambiar={cambiar} />
        <SeccionFechas titulo="Ejecución" campos={CAMPOS_EJECUCION} valores={valores} cambiar={cambiar} />
        <SeccionConsideraciones valores={valores} cambiar={cambiar} />
        {errores.map((error) => (
          <Alert key={error} tono="error">
            {error}
          </Alert>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <Button type="submit" variant="primary" icon="save" loading={guardarItem.isPending || notificar.isPending}>
            {item ? 'Guardar cambios' : 'Crear ítem'}
          </Button>
          <Button icon="close" onClick={alCerrar}>
            Cerrar
          </Button>
        </div>
      </form>
    </Card>
  )
}
