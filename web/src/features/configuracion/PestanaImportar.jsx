import { useState } from 'react'
import { useToast } from '../../context/ToastContext'
import { useImportarPlan } from '../../hooks/useConfiguracion'
import { leerPlan } from '../../lib/excel/leerPlan'
import { prepararFilas } from '../../lib/excel/prepararFilas'
import { Alert, Button, DataTable, Field } from '../../components/ui'

const COLUMNAS_VISTA = [
  { clave: 'hoja', titulo: 'Hoja' },
  { clave: 'cliente', titulo: 'Cliente' },
  { clave: 'actividad', titulo: 'Actividad' },
  { clave: 'modulo', titulo: 'Módulo' },
  { clave: 'funcionalidad', titulo: 'Funcionalidad', ancho: 200 },
  { clave: 'fase', titulo: 'Fase' },
  { clave: 'alcance', titulo: 'Alcance' },
  { clave: 'responsable', titulo: 'Responsable' },
  { clave: 'plan_fin', titulo: 'Fin desarrollo plan.' },
  { clave: 'plan_pruebas_fin', titulo: 'Fin pruebas plan.' },
  { clave: 'estado', titulo: 'Estado' },
]

function ResumenPrevia({ filas, previa }) {
  const deducidos = filas.filter((fila) => fila.estado_deducido).length
  return (
    <p className="text-sm">
      <b>{filas.length} filas leídas</b> · {previa.nuevos} nuevas · {previa.actualizados} ya existen y se revisarán
      {deducidos > 0 &&
        ` · ${deducidos} sin estado (se deduce: «En curso» si tiene fecha real, si no «No iniciado»)`}
    </p>
  )
}

function textoResultado(r) {
  return (
    `Importación lista: ${r.nuevos} ítems nuevos, ${r.actualizados} actualizados (${r.reprogramaciones} con cambio de fechas), ` +
    `${r.sin_cambios} sin cambios y ${r.notas} notas nuevas en la bitácora.`
  )
}

export function PestanaImportar() {
  const [lectura, setLectura] = useState(null)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState('')
  const importar = useImportarPlan()
  const toast = useToast()

  const elegirArchivo = async (evento) => {
    const archivo = evento.target.files[0]
    evento.target.value = ''
    if (!archivo) return
    setError('')
    setResultado('')
    setLectura(null)
    try {
      const { filas, avisos } = leerPlan(new Uint8Array(await archivo.arrayBuffer()))
      if (!filas.length) return setError(`No encontré filas del plan en ese archivo. ${avisos.join(' ')}`)
      const preparadas = prepararFilas(filas)
      const previa = await importar.mutateAsync({ filas: preparadas, simular: true })
      setLectura({ filas: preparadas, avisos, previa })
    } catch (fallo) {
      setError(`No se pudo leer el archivo: ${fallo.message}`)
    }
  }

  const confirmar = async () => {
    try {
      const r = await importar.mutateAsync({ filas: lectura.filas, simular: false })
      setResultado(textoResultado(r))
      setLectura(null)
      toast('Importación completada.')
    } catch (fallo) {
      setError(fallo.message)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Sube tu <b>Plan de Trabajo</b> (.xlsx, una hoja por cliente, con las columnas Cliente, Actividad, Menú/Funcionalidad,
        Módulo/Componente, Fase, Alcance, Responsable, fechas de planificación y ejecución, Consideraciones y Estado).
      </p>
      <p className="text-xs text-ink-muted">
        Los ítems que ya existen (mismo cliente, actividad, módulo, funcionalidad, fase y alcance) se actualizan con los datos del
        Excel: los cambios de fecha planificada quedan en la bitácora como reprogramación y las consideraciones nuevas se agregan como
        notas. La descripción y los bloqueos que registraste en la app se conservan.
      </p>
      <Field label="Archivo del Plan de Trabajo">
        <input
          type="file"
          accept=".xlsx"
          onChange={elegirArchivo}
          className="field-control py-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-line-soft file:px-3 file:py-1 file:text-sm file:font-semibold"
        />
      </Field>
      {importar.isPending && !lectura && <p className="text-sm text-ink-muted">Leyendo el archivo…</p>}
      {error && <Alert tono="error">{error}</Alert>}
      {resultado && <Alert tono="exito">{resultado}</Alert>}
      {lectura && (
        <>
          <ResumenPrevia filas={lectura.filas} previa={lectura.previa} />
          {lectura.previa.personas_nuevas.length > 0 && (
            <Alert tono="info" icono="person_add">
              Se agregarán al equipo (sin correo): {lectura.previa.personas_nuevas.join(', ')}
            </Alert>
          )}
          {lectura.avisos.map((aviso) => (
            <Alert key={aviso} tono="aviso">
              {aviso}
            </Alert>
          ))}
          <DataTable columnas={COLUMNAS_VISTA} filas={lectura.filas} claveFila={(fila) => fila.clave} alturaMaxima={300} />
          <Button variant="primary" icon="upload" loading={importar.isPending} onClick={confirmar}>
            Importar {lectura.filas.length} filas
          </Button>
        </>
      )}
    </div>
  )
}
