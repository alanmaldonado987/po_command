import { useState } from 'react'
import { useToast } from '../../context/ToastContext'
import { useConfiguracion, useGuardarConfiguracion } from '../../hooks/useConfiguracion'
import { Button, Card, TextField } from '../../components/ui'

function FormularioPo({ inicial }) {
  const [nombre, setNombre] = useState(inicial.po_nombre ?? '')
  const [correo, setCorreo] = useState(inicial.po_correo ?? '')
  const guardar = useGuardarConfiguracion()
  const toast = useToast()

  const enviar = async (evento) => {
    evento.preventDefault()
    try {
      await guardar.mutateAsync({ clave: 'po_nombre', valor: nombre })
      await guardar.mutateAsync({ clave: 'po_correo', valor: correo.trim() })
      toast('Datos del PO guardados.')
    } catch (fallo) {
      toast(fallo.message, 'error')
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <TextField label="Nombre" value={nombre} onChange={setNombre} />
      <TextField label="Correo (recibe y respalda alertas)" type="email" value={correo} onChange={setCorreo} />
      <Button type="submit" variant="primary" icon="save" full loading={guardar.isPending}>
        Guardar
      </Button>
    </form>
  )
}

export function TarjetaPo() {
  const { data: config } = useConfiguracion()
  return (
    <Card title="Product Owner" icon="person">
      {config && <FormularioPo inicial={config} />}
    </Card>
  )
}
