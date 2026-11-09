# 07 · Prueba funcional: Analítica (`/analitica`)

> Copia todo este archivo como prompt. Prefijo de casos: **AN**.

## Rol y mentalidad
QA senior de datos: recalculas cada métrica con SQL independiente y buscas diferencias de definición (qué cuenta como «a tiempo», «abierto», «atrasado») y de población (filtros, nulos, truncamiento).

## Contexto técnico
- Página `web/src/pages/Analitica.jsx`; cálculo en `features/analitica/metricas.js`; componentes `KpisAnalitica`, `AvanceAgrupado` (por actividad y por alcance), `PorResponsable`, `ModulosConAtrasos` (top 10), `AlertasPorRegla`, `TablaClienteActividad`.
- Datos: `useItems` (v_item), `useTodasLasNotas` (todas las notas), `useBloqueantes` (todos), y `notificacion_log` (`listarAlertasPorRegla`).
- Definiciones: avance = Terminados/total; entrega a tiempo = terminados con `fecha_compromiso` y `fecha_entrega` cuyo `atraso_dias = 0` / terminados con ambas fechas; atrasados = `atrasado` (no cerrados con atraso); reprogramaciones = notas tipo `Reprogramación` de los ítems filtrados; resolución de bloqueos = promedio de horas (`resuelto_en − abierto_en`) de bloqueos resueltos de los ítems filtrados.
- Filtros: Cliente y Alcance (multiselección, vacío = todos). El estado «Suspendido» y otros se agrupan en «suspendidos».

## Archivos a leer
`pages/Analitica.jsx`, `features/analitica/*`, `components/charts/*`, `lib/dominio.js`, `api/items.js`, `api/alertas.js` (`listarAlertasPorRegla`).

## Datos de prueba
Plan importado + casos construidos: terminados a tiempo y tarde, terminado sin fecha de entrega, atrasados con 1/10/60 días, bloqueos resueltos (2 h y 50 h), reprogramaciones en distintos clientes, ítems sin cliente/actividad/alcance/responsable, log con enviadas y fallidas por regla.

## Escenarios
| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| AN-01 | Base vacía | Sin ítems | «Aún no hay ítems en el backlog.» |
| AN-02 | KPI Avance | Comparar con SQL | % y «X de N ítems terminados» exactos |
| AN-03 | KPI Entrega a tiempo | 3 a tiempo, 1 tarde, 1 sin entrega | 75 % (3/4); «-» si ninguno cumple la condición |
| AN-04 | KPI Atrasados | Con 3 atrasados de 1, 10 y 60 días | 3 y «24 días en promedio» (redondeo); «Ninguno» si 0 |
| AN-05 | KPI Reprogramaciones | Notas de 2 clientes con filtro de uno | Solo las del filtro |
| AN-06 | KPI Resolución de bloqueos | Bloqueos de 2 h y 50 h | 26 h; «-» si no hay resueltos |
| AN-07 | Filtro cliente | Elegir 1 y 2 | Todos los bloques se recalculan; el filtro de alcance usa los valores de TODOS los ítems |
| AN-08 | Filtro vacío | Combinación sin ítems | «Ningún ítem coincide con el filtro.» |
| AN-09 | Avance por actividad | Revisar | Barras apiladas por estado; «Sin actividad» para nulos |
| AN-10 | Avance por alcance | Revisar | «-» para alcance vacío |
| AN-11 | Abiertos y atrasados por responsable | Revisar | Orden por abiertos; «Sin asignar» incluido; atrasados ≤ abiertos |
| AN-12 | Módulos con más atrasos | 12 módulos con atrasos | Top 10 descendente; mensaje de vacío si ninguno |
| AN-13 | Alertas por regla | Log con Enviada/Fallida/Omitida | Solo Enviadas y Fallidas; confirmar que «Omitida» no infla (ver H-07) |
| AN-14 | Tabla cliente·actividad | Expandir | Conteos por estado y «Atrasados» coinciden con SQL |
| AN-15 | Consistencia cruzada | Comparar con Centro de Mando | Mismos totales de avance y atrasados |
| AN-16 | Colores | Revisar | Colores por estado iguales a los del Centro de Mando |
| AN-17 | Más de 1 000 ítems/notas | Volumen | Documentar truncamiento de KPIs de reprogramaciones y totales (H-03) |
| AN-18 | Cambio de datos | Cambiar estados en Backlog y volver | Se refrescan al volver (staleTime 15 s) |
| AN-19 | Valores nulos | Ítems sin `fecha_entrega` y `Terminado` | No generan NaN ni errores |
| AN-20 | Responsive | 375 px | Gráficos legibles, sin desbordes |

## Puntos sospechosos
- `api/items.js:32` (`listarTodasLasNotas`): sin `order` y con tope de 1 000; `calcularKpis` cuenta reprogramaciones sobre ese subconjunto (H-03).
- `metricas.js:13`: «a tiempo» exige `atraso_dias === 0`, pero la vista devuelve 0 también para `Terminado` sin `fecha_entrega`; el ítem queda excluido por `conFechas`, lo cual es correcto, pero un ítem terminado entregado el mismo día cuenta como a tiempo: confirmar contra el original.
- `metricas.js:59-66` cuenta solo `Enviada`/`Fallida`; las «Omitida» inflan el log pero no el gráfico (confirmar).
- Las métricas dependen de `fecha_compromiso = plan_pruebas_fin ?? plan_fin`; ítems sin fechas nunca se atrasan.
- `Analitica.jsx:20-23`: si `useTodasLasNotas` falla, toda la página falla.

## Evidencia a capturar
Captura de cada KPI/gráfico + consulta SQL equivalente (pega la consulta y el resultado), datos de entrada del caso.

## Severidad y prioridad
Métrica errónea = S2/P1. Gráfico ilegible = S3. Estilo = S4.

## Formato de salida
| ID | Escenario | Resultado | Evidencia | Bug (ID, S/P) |
Después: bugs con la plantilla `98` y tres recomendaciones.
