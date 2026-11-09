import { useMemo } from 'react'
import { desdeIsoFecha, diasEntre, formatoFecha, sumarDias } from '../../lib/fechas'

const ANCHO_ETIQUETA = 280
const ALTO_FILA = 34
const PX_POR_DIA = 12
const MARGEN_DIAS = 3
const MIN_DIAS_VISIBLES = 30

function calcularRango(filas) {
  const fechas = filas.flatMap((fila) => fila.tramos.flatMap((tramo) => [tramo.inicio, tramo.fin]))
  const ordenadas = [...fechas].sort()
  const inicio = sumarDias(ordenadas[0], -MARGEN_DIAS)
  const fin = sumarDias(ordenadas[ordenadas.length - 1], MARGEN_DIAS)
  return { inicio, dias: Math.max(diasEntre(inicio, fin), MIN_DIAS_VISIBLES) }
}

function pasoDeEje(dias) {
  if (dias > 365) return 30
  if (dias > 120) return 14
  return 7
}

function marcasDeEje(inicio, dias, paso) {
  const primera = desdeIsoFecha(inicio)
  const desplazamiento = (8 - primera.getDay()) % 7
  const marcas = []
  for (let dia = desplazamiento; dia <= dias; dia += paso) marcas.push(dia)
  return marcas.map((dia) => ({ dia, etiqueta: formatoFecha(sumarDias(inicio, dia)).slice(0, 5) }))
}

function Barra({ tramo, inicio }) {
  const izquierda = diasEntre(inicio, tramo.inicio) * PX_POR_DIA
  const ancho = Math.max(diasEntre(tramo.inicio, tramo.fin) * PX_POR_DIA, 4)
  const altura = tramo.ejecutado ? 9 : 20
  return (
    <div
      className="absolute rounded"
      style={{
        left: izquierda,
        width: ancho,
        height: altura,
        top: (ALTO_FILA - altura) / 2,
        background: tramo.color,
      }}
    />
  )
}

export function GanttChart({ filas, hoy, leyenda }) {
  const { inicio, dias } = useMemo(() => calcularRango(filas), [filas])
  const paso = pasoDeEje(dias)
  const marcas = useMemo(() => marcasDeEje(inicio, dias, paso), [inicio, dias, paso])
  const anchoLinea = dias * PX_POR_DIA
  const posicionHoy = diasEntre(inicio, hoy) * PX_POR_DIA
  const hoyVisible = posicionHoy >= 0 && posicionHoy <= anchoLinea

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <div className="relative" style={{ width: ANCHO_ETIQUETA + anchoLinea }}>
          <div className="flex border-b border-line bg-line-soft text-[11px] font-semibold text-ink-muted">
            <div className="sticky left-0 z-20 flex-none bg-line-soft px-3 py-2" style={{ width: ANCHO_ETIQUETA }}>
              Ítem
            </div>
            <div className="relative h-8 flex-none" style={{ width: anchoLinea }}>
              {marcas.map(({ dia, etiqueta }) => (
                <span key={dia} className="absolute top-2 -translate-x-1/2" style={{ left: dia * PX_POR_DIA }}>
                  {etiqueta}
                </span>
              ))}
              {hoyVisible && (
                <span className="absolute top-2 -translate-x-1/2 font-bold text-danger" style={{ left: posicionHoy }}>
                  Hoy
                </span>
              )}
            </div>
          </div>

          {filas.map(({ id, etiqueta, detalle, tramos }) => (
            <div key={id} title={detalle} className="flex border-b border-line-soft last:border-b-0" style={{ height: ALTO_FILA }}>
              <div
                className="sticky left-0 z-10 flex-none truncate bg-white px-3 text-[11px] leading-[34px] text-ink-soft"
                style={{ width: ANCHO_ETIQUETA }}
              >
                {etiqueta}
              </div>
              <div
                className="relative flex-none"
                style={{
                  width: anchoLinea,
                  backgroundImage: 'linear-gradient(to right, #EEF2F6 1px, transparent 1px)',
                  backgroundSize: `${paso * PX_POR_DIA}px 100%`,
                }}
              >
                {tramos.map((tramo) => (
                  <Barra key={tramo.clave} tramo={tramo} inicio={inicio} />
                ))}
              </div>
            </div>
          ))}

          {hoyVisible && (
            <div
              className="pointer-events-none absolute bottom-0 top-8 border-l border-dotted border-danger"
              style={{ left: ANCHO_ETIQUETA + posicionHoy }}
            />
          )}
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-soft">
        {leyenda.map(({ nombre, color }) => (
          <li key={nombre} className="flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
            {nombre}
          </li>
        ))}
      </ul>
    </div>
  )
}
