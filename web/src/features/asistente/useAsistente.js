import { useState } from 'react'
import { resolverDestinatarios } from '../../api/alertas'
import { useAcuerdos, useCeremonias } from '../../hooks/useCeremonias'
import { useCatalogo } from '../../hooks/useCatalogos'
import { useReglas } from '../../hooks/useAlertas'
import { useEnviarResumen, useEscalarBloqueo, useRecordarVencimientos } from '../../hooks/useAlertas'
import { useConfiguracion } from '../../hooks/useConfiguracion'
import { useEstadoIa, useRedactarConModelo } from '../../hooks/useIa'
import { useBloqueantesAbiertos, useItems, useTodasLasNotas } from '../../hooks/useItems'
import { usePersonas } from '../../hooks/usePersonas'
import { responder } from './motor/responder'

const HISTORIAL_MODELO = 6

export function useAsistente() {
  const consultas = {
    items: useItems(),
    bloqueantes: useBloqueantesAbiertos(),
    personas: usePersonas(),
    ceremonias: useCeremonias(),
    acuerdos: useAcuerdos(),
    notas: useTodasLasNotas(),
    reglas: useReglas(),
    clientes: useCatalogo('cliente'),
    configuracion: useConfiguracion(),
  }
  const estadoIa = useEstadoIa()
  const redactar = useRedactarConModelo()
  const escalar = useEscalarBloqueo()
  const enviarResumen = useEnviarResumen()
  const recordar = useRecordarVencimientos()

  const [mensajes, setMensajes] = useState([])
  const [resultados, setResultados] = useState({})
  const [pensando, setPensando] = useState(false)
  const [ejecutando, setEjecutando] = useState(null)

  const error = Object.values(consultas).find((consulta) => consulta.error)?.error
  const listo = Object.values(consultas).every((consulta) => consulta.data)

  const armarDatos = () => {
    const { configuracion, ...tablas } = consultas
    return {
      ...Object.fromEntries(Object.entries(tablas).map(([clave, consulta]) => [clave, consulta.data])),
      po: { nombre: configuracion.data.po_nombre },
      resolverDestinatarios,
    }
  }

  const polirConModelo = async (pregunta, borrador, historial) => {
    try {
      const { texto } = await redactar.mutateAsync({ pregunta, borrador, historial })
      return texto
    } catch (fallo) {
      return `${borrador}\n\n*(No pude usar el modelo configurado: ${fallo.message}. Respondí con el asistente local.)*`
    }
  }

  const enviar = async (pregunta) => {
    const historial = mensajes.map(({ rol, contenido }) => ({ role: rol, content: contenido }))
    const usuario = { id: crypto.randomUUID(), rol: 'user', contenido: pregunta }
    setMensajes((actuales) => [...actuales, usuario])
    setPensando(true)
    try {
      const { texto, acciones } = await responder(pregunta, armarDatos())
      const contenido = estadoIa.data?.disponible
        ? await polirConModelo(pregunta, texto, historial.slice(-HISTORIAL_MODELO))
        : texto
      setMensajes((actuales) => [...actuales, { id: crypto.randomUUID(), rol: 'assistant', contenido, acciones }])
    } catch (fallo) {
      setMensajes((actuales) => [
        ...actuales,
        { id: crypto.randomUUID(), rol: 'assistant', contenido: `No pude responder: ${fallo.message}` },
      ])
    } finally {
      setPensando(false)
    }
  }

  const ejecutar = async (accion, clave) => {
    setEjecutando(clave)
    try {
      const respuesta = await {
        escalar: () => escalar.mutateAsync(accion.id),
        resumen: () => enviarResumen.mutateAsync(),
        recordar: () => recordar.mutateAsync(accion.ids),
      }[accion.tipo]()
      setResultados((actuales) => ({ ...actuales, [clave]: respuesta?.mensaje ?? 'Acción ejecutada.' }))
    } catch (fallo) {
      setResultados((actuales) => ({ ...actuales, [clave]: `No se pudo ejecutar: ${fallo.message}` }))
    } finally {
      setEjecutando(null)
    }
  }

  const reiniciar = () => {
    setMensajes([])
    setResultados({})
  }

  return { error, listo, mensajes, resultados, pensando, ejecutando, enviar, ejecutar, reiniciar, estadoIa: estadoIa.data }
}
