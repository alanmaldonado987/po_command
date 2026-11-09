export const COLOR_CUADRICULA = '#EEF2F6'

export const ESTILO_TEXTO = {
  fontFamily: 'Inter, Segoe UI, sans-serif',
  fontSize: 12,
  fill: '#334155',
}

export const ESTILO_TOOLTIP = {
  contentStyle: {
    fontFamily: 'Inter, Segoe UI, sans-serif',
    fontSize: 12,
    borderRadius: 10,
    border: '1px solid #E2E8F0',
  },
  cursor: { fill: 'rgba(15,23,42,.04)' },
}

export const ESTILO_LEYENDA = {
  wrapperStyle: { fontFamily: 'Inter, Segoe UI, sans-serif', fontSize: 12, paddingTop: 8 },
  iconType: 'circle',
  iconSize: 8,
}

const PX_POR_CARACTER = 6.5
const ANCHO_MINIMO_ETIQUETA = 60
const ANCHO_MAXIMO_ETIQUETA = 240

export function anchoEtiquetas(categorias) {
  const largo = Math.max(0, ...categorias.map((categoria) => String(categoria).length))
  return Math.min(ANCHO_MAXIMO_ETIQUETA, Math.max(ANCHO_MINIMO_ETIQUETA, largo * PX_POR_CARACTER))
}

export const altoPorFilas = (filas, alturaFila = 36, base = 80) => base + alturaFila * filas
