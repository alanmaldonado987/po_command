# 03 · Prueba funcional: Cronograma (`/cronograma`)

> Copia todo este archivo como prompt. Prefijo de casos: **CR**.

## Rol y mentalidad
QA senior con ojo para fechas: husos horarios, inclusión del último día, rangos vacíos o enormes, y fidelidad entre lo que dibuja el Gantt y los datos.

## Contexto técnico
- Página `web/src/pages/Cronograma.jsx`; filtros `features/cronograma/FiltrosCronograma.jsx` (cliente único, actividades, responsables, «Solo abiertos» activado por defecto), `KpisCronograma.jsx`, `ItemsSinFechas.jsx`, `tramos.js`, `components/charts/GanttChart.jsx`.
- Cuatro tramos por ítem: desarrollo planificado `plan_ini→plan_fin` (celeste), pruebas planificadas `plan_pruebas_ini→plan_pruebas_fin` (amarillo), desarrollo ejecutado `real_ini→real_fin` (azul oscuro, barra delgada), pruebas ejecutadas `real_pruebas_ini→real_pruebas_fin` (naranja). Si falta un extremo se usa el otro; el fin incluye el día completo (`sumarDias(fin, 1)`).
- Línea «Hoy» roja punteada con `hoyIso()` (hora local del navegador). Escala: 12 px por día, margen de 3 días, mínimo 30 días, eje cada 7/14/30 días según el rango.
- Tooltip: atributo `title` de la fila con código, estado, responsable, atraso y fin planificado.

## Archivos a leer
`pages/Cronograma.jsx`, `features/cronograma/*`, `components/charts/GanttChart.jsx`, `lib/fechas.js`, `lib/dominio.js`.

## Datos de prueba
Un cliente con: ítem con los 4 tramos; ítem con solo `plan_fin`; ítem sin fechas; ítem con fecha ejecutada y sin planificada; ítems que cruzan el cambio de año; ítem terminado; ítem bloqueado. Un segundo cliente con pocos ítems. Un ítem con año 2999 (límite).

## Escenarios
| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| CR-01 | Selección de cliente por defecto | Abrir la página | Primer cliente alfabético; título «Cronograma · {cliente}» |
| CR-02 | Cambio de cliente | Elegir otro | Filtros de actividad/responsable se limitan a ese cliente; filtros previos no arrastran valores inexistentes |
| CR-03 | Solo abiertos | Alternar | Con activo: sin Terminado/Suspendido; sin activo: todos |
| CR-04 | Filtros múltiples | Actividades + responsables | Intersección correcta |
| CR-05 | KPIs | Comparar con SQL | Ítems en vista; Atrasados (no cerrados con atraso); En pruebas; Sin fechas |
| CR-06 | Cuatro tramos | Ítem completo | 4 barras con los colores/alturas correctos, leyenda con 4 entradas |
| CR-07 | Último día incluido | Tramo de un solo día | Barra de ancho mínimo visible (≥ 4 px, 1 día) |
| CR-08 | Extremo único | Solo `plan_fin` | Barra de un día en esa fecha |
| CR-09 | Línea «Hoy» | Rango que incluye hoy / no incluye | Visible y alineada solo si está en el rango |
| CR-10 | Eje | Rangos de 2 meses, 6 meses, 2 años | Paso 7/14/30 días; etiquetas dd/mm sin solaparse |
| CR-11 | Orden | Varios ítems | Orden por inicio mínimo ascendente |
| CR-12 | Ítems sin fechas | Abrir el expander | Listados con código, módulo, funcionalidad, alcance, responsable, estado |
| CR-13 | Todo sin fechas | Filtrar a ítems sin fechas | «Ningún ítem de este filtro tiene fechas.» |
| CR-14 | Sin clientes | Base vacía | Mensaje de vacío que remite a Backlog/Configuración |
| CR-15 | Tooltip | Pasar el cursor; con teclado | Muestra detalle; **verificar acceso por teclado/lector** (H-14) |
| CR-16 | Desplazamiento | Rango largo | Scroll horizontal; etiqueta de ítem fija a la izquierda; cabecera visible |
| CR-17 | Fechas extremas | Ítem con año 2999 o 0202 | La página debe seguir respondiendo; documentar anchos gigantes o congelamiento (H-17) |
| CR-18 | Cambio de huso | Zona del sistema UTC+9 / UTC-8 | La línea «Hoy» y los días de atraso no deben moverse un día sin explicación (H-09) |
| CR-19 | Datos vivos | Editar un ítem en Backlog y volver | El Gantt refleja el cambio |
| CR-20 | 500 ítems en un cliente | Generar volumen | Renderiza en tiempo razonable; medir (prompt 14) |
| CR-21 | Móvil 375 px | Revisar | Sin desbordes de página; el Gantt hace scroll interno |

## Puntos sospechosos
- `GanttChart.jsx:10-30`: `calcularRango` y `marcasDeEje` no limitan el rango; un año atípico crea miles de marcas (H-17).
- `GanttChart.jsx:37-47,81`: barras sin texto alternativo (H-14).
- `Cronograma.jsx:59`: `hoyIso()` usa la zona del navegador (H-09).
- `tramos.js:13-19`: si falta el inicio se usa el fin y viceversa; una fecha fin anterior al inicio produce barra de ancho mínimo sin aviso.
- `Cronograma.jsx:23`: si el cliente seleccionado desaparece (se elimina en otra pestaña) vuelve al primero.

## Evidencia a capturar
Capturas del Gantt con los datos de cada caso, consulta SQL de los tramos, consola, medición de tiempo de render en el caso de volumen.

## Severidad y prioridad
Barra que no corresponde a los datos = S2/P1. Congelamiento con fechas extremas = S3/P2. Estilo = S4.

## Formato de salida
| ID | Escenario | Resultado | Evidencia | Bug (ID, S/P) |
Después: bugs con la plantilla `98` y tres recomendaciones.
