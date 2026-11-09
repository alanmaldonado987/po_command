import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ESTILO_LEYENDA, ESTILO_TOOLTIP } from './tema'

export function DonutChart({ datos, total, etiquetaTotal, alto = 250 }) {
  return (
    <div className="relative" style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={datos}
            dataKey="valor"
            nameKey="nombre"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={1}
            stroke="none"
            label={({ valor }) => valor}
            labelLine={false}
          >
            {datos.map(({ nombre, color }) => (
              <Cell key={nombre} fill={color} />
            ))}
          </Pie>
          <Tooltip {...ESTILO_TOOLTIP} />
          <Legend {...ESTILO_LEYENDA} verticalAlign="bottom" />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-[calc(50%-22px)] text-center text-sm leading-tight text-ink">
        <b className="text-base">{total}</b>
        <br />
        {etiquetaTotal}
      </div>
    </div>
  )
}
