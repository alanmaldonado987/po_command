import { cx } from '../../lib/cx'

function alternarSeleccion(claves, clave, multiple) {
  if (!multiple) return claves.includes(clave) ? [] : [clave]
  return claves.includes(clave) ? claves.filter((actual) => actual !== clave) : [...claves, clave]
}

export function DataTable({
  columnas,
  filas,
  claveFila,
  seleccion = [],
  alSeleccionar,
  multiple = false,
  alturaMaxima = 520,
  vacio = 'Sin registros',
}) {
  const seleccionable = Boolean(alSeleccionar)
  const seleccionar = (clave) => alSeleccionar(alternarSeleccion(seleccion, clave, multiple))
  const alPresionarTecla = (evento, clave) => {
    if (evento.key !== 'Enter' && evento.key !== ' ') return
    evento.preventDefault()
    seleccionar(clave)
  }

  return (
    <div className="overflow-auto rounded-xl border border-line" style={{ maxHeight: alturaMaxima }}>
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-10 bg-line-soft text-left text-xs font-bold text-ink-soft">
          <tr>
            {multiple && <th className="w-9 px-2.5 py-2" />}
            {columnas.map(({ clave, titulo, ancho, fijo }) => (
              <th
                key={clave}
                style={{ minWidth: ancho }}
                className={cx('whitespace-nowrap px-3 py-2', fijo && 'sticky left-0 z-20 bg-line-soft')}
              >
                {titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && (
            <tr>
              <td colSpan={columnas.length + 1} className="px-3 py-8 text-center text-ink-muted">
                {vacio}
              </td>
            </tr>
          )}
          {filas.map((fila) => {
            const clave = claveFila(fila)
            const activa = seleccion.includes(clave)
            return (
              <tr
                key={clave}
                tabIndex={seleccionable ? 0 : undefined}
                aria-selected={seleccionable ? activa : undefined}
                onClick={seleccionable ? () => seleccionar(clave) : undefined}
                onKeyDown={seleccionable ? (evento) => alPresionarTecla(evento, clave) : undefined}
                className={cx(
                  'border-t border-line-soft',
                  seleccionable && 'cursor-pointer hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand',
                  activa && 'bg-brand-soft/60',
                )}
              >
                {multiple && (
                  <td className="px-2.5 py-2">
                    <input type="checkbox" readOnly tabIndex={-1} aria-label="Seleccionar fila" checked={activa} className="h-4 w-4 accent-brand" />
                  </td>
                )}
                {columnas.map(({ clave: campo, render, fijo }) => (
                  <td
                    key={campo}
                    className={cx('px-3 py-2 align-top text-ink-soft', fijo && 'sticky left-0 bg-inherit font-semibold text-ink')}
                  >
                    {render ? render(fila) : (fila[campo] ?? '')}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
