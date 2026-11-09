import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  COLOR_CUADRICULA,
  ESTILO_LEYENDA,
  ESTILO_TEXTO,
  ESTILO_TOOLTIP,
  altoPorFilas,
  anchoEtiquetas,
} from './tema'

export function HorizontalStackedBars({ datos, claveCategoria, series }) {
  const ancho = anchoEtiquetas(datos.map((fila) => fila[claveCategoria]))

  return (
    <div style={{ height: altoPorFilas(datos.length, 44) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 4 }} barCategoryGap="30%">
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
          <Legend {...ESTILO_LEYENDA} verticalAlign="bottom" />
          {series.map(({ clave, nombre, color }) => (
            <Bar key={clave} dataKey={clave} name={nombre} stackId="apilado" fill={color} radius={4} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
