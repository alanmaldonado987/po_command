import { useEffect, useRef, useState } from 'react'
import { Button, Card, ErrorState, Hero, Icon, LoadingState, PillsSelect, TextField } from '../components/ui'
import { MensajeChat } from '../features/asistente/MensajeChat'
import { AYUDA, SUGERENCIAS } from '../features/asistente/motor/constantes'
import { TextoMarkdown } from '../features/asistente/TextoMarkdown'
import { useAsistente } from '../features/asistente/useAsistente'

const BIENVENIDA = { id: 'bienvenida', rol: 'assistant', contenido: `Hola, soy tu copiloto. ${AYUDA}` }

export default function Asistente() {
  const asistente = useAsistente()
  const [pregunta, setPregunta] = useState('')
  const final = useRef(null)

  useEffect(() => {
    final.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [asistente.mensajes, asistente.pensando])

  if (asistente.error) return <ErrorState error={asistente.error} />
  if (!asistente.listo) return <LoadingState />

  const insignia = asistente.estadoIa?.disponible ? `Modelo ${asistente.estadoIa.modelo}` : 'Asistente local · sin API key'
  const preguntar = (texto) => {
    const limpia = texto.trim()
    if (!limpia || asistente.pensando) return
    setPregunta('')
    asistente.enviar(limpia)
  }
  const enviarFormulario = (evento) => {
    evento.preventDefault()
    preguntar(pregunta)
  }

  return (
    <>
      <Hero
        kicker="IA ASISTENTE"
        titulo="Tu copiloto de PO"
        subtitulo="Responde con los datos de tu base. Las acciones que propone solo se ejecutan cuando pulsas el botón."
        insignias={[[insignia, 'oscuro']]}
      />
      <PillsSelect
        opciones={SUGERENCIAS}
        multiple={false}
        value={null}
        onChange={preguntar}
      />
      <Card>
        <div className="flex flex-col gap-4">
          {asistente.mensajes.length === 0 && (
            <div className="flex gap-3">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-success-soft text-success-ink">
                <Icon name="auto_awesome" className="text-[18px]" />
              </span>
              <div className="rounded-card border border-line bg-white px-4 py-3.5">
                <TextoMarkdown texto={BIENVENIDA.contenido} />
              </div>
            </div>
          )}
          {asistente.mensajes.map((mensaje) => (
            <MensajeChat
              key={mensaje.id}
              mensaje={mensaje}
              resultados={asistente.resultados}
              ejecutando={asistente.ejecutando}
              alEjecutar={asistente.ejecutar}
            />
          ))}
          {asistente.pensando && <LoadingState texto="Pensando…" />}
          <div ref={final} />
        </div>
        {asistente.mensajes.length > 0 && (
          <div>
            <Button icon="refresh" onClick={asistente.reiniciar}>
              Nueva conversación
            </Button>
          </div>
        )}
      </Card>
      <form onSubmit={enviarFormulario} className="sticky bottom-3 flex items-end gap-2 rounded-xl border border-line bg-white p-2.5 shadow-card">
        <TextField
          className="flex-1"
          placeholder="Pregunta sobre tu backlog, un cliente, un ítem (BL-012) o una persona…"
          value={pregunta}
          onChange={setPregunta}
        />
        <Button type="submit" variant="primary" icon="send" disabled={asistente.pensando || !pregunta.trim()}>
          Enviar
        </Button>
      </form>
    </>
  )
}
