import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  COLOR_CUADRICULA,
  ESTILO_LEYENDA,
  ESTILO_TEXTO,
  ESTILO_TOOLTIP,
  altoPorFilas,
  anchoEtiquetas,
} from './tema'

const GROSOR_BARRA = 18

export function HorizontalBars({ datos, claveCategoria, series, solapadas = false, mostrarValores = false, leyenda = true }) {
  const ancho = anchoEtiquetas(datos.map((fila) => fila[claveCategoria]))

  return (
    <div style={{ height: altoPorFilas(datos.length, 34) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={datos}
          layout="vertical"
          margin={{ top: 4, right: mostrarValores ? 24 : 8, bottom: 4, left: 4 }}
          barSize={GROSOR_BARRA}
          barGap={solapadas ? -GROSOR_BARRA : 4}
        >
          <CartesianGrid stroke={COLOR_CUADRICULA} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={ESTILO_TEXTO} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey={claveCategoria}
            width={ancho}
            tick={ESTILO_TEXTO}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip {...ESTILO_TOOLTIP} />
          {leyenda && <Legend {...ESTILO_LEYENDA} verticalAlign="bottom" />}
          {series.map(({ clave, nombre, color }) => (
            <Bar key={clave} dataKey={clave} name={nombre} fill={color} radius={4}>
              {mostrarValores && <LabelList dataKey={clave} position="right" style={ESTILO_TEXTO} />}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
