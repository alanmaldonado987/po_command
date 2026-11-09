# 14 · Rendimiento y carga (incluye el límite de 1 000 filas de PostgREST)

> Copia todo este archivo como prompt. Prefijo de casos: **RN**. Solo en el proyecto de pruebas (plan gratuito: tenerlo en cuenta al interpretar tiempos).

## Rol y mentalidad
Ingeniero de rendimiento: mides antes de opinar (percentiles, no promedios), buscas el punto de quiebre y descubres **correcciones silenciosas** (datos que se truncan sin avisar). Documentas el entorno con cada medición.

## Contexto técnico
- Todo el frontend lee listados completos al abrir cada página: `listarItems` (vista `v_item`), `listarTodasLasNotas` (texto completo de todas las notas), `listarBloqueantes`, `listarPersonas`, `listarCeremonias`, `listarAcuerdos` (`web/src/api/*.js`). **Ninguno usa `.range()` ni paginación** y PostgREST aplica `max_rows` (por defecto 1 000 en Supabase; verificar en Settings → API). Resultado: con más de 1 000 filas el listado se corta **sin error**.
- `web/src/api/configuracion.js:41` (`leerTabla`): `.limit(50000)` no supera `max_rows` → respaldo truncado.
- Edge Functions leen `v_item` completo (`_shared/items.ts:7-13`, `resumen.ts:37`).
- Caché: React Query con `staleTime` 15 s y refetch al volver a la ventana (`web/src/main.jsx`); varias páginas disparan 5–9 consultas a la vez (`useAsistente.js`, `Ceremonias.jsx`).
- Importación: `importar_plan` en una sola transacción desde el navegador (`PestanaImportar.jsx:58,67`); el rol `authenticated` suele tener `statement_timeout` ≈ 8 s (verificar con `show statement_timeout` ejecutado bajo ese rol).
- Edge: `despachar` secuencial; `revisarCeremonias`/`avisarVencimientos` consultan `v_persona` y `config` por cada alerta (`resolver`).
- Tamaño del bundle (`npm run build`): `index` ≈ 446 kB, gráfico de barras (recharts) ≈ 389 kB, librería de Excel ≈ 426 kB (se carga con el Backlog/Configuración).
- Índices: `item(cliente_id)` y `item(responsable_id)` parciales, `item(clave_importacion)`, `nota(item_id)`, `alerta_programada(estado, enviar_en)`, `notificacion_log(fecha desc)`, `auditoria(fecha desc)`. `v_item` hace 5 `left join`; `v_persona` agrega con `group by`.

## Archivos a leer
`web/src/api/*.js`, `web/src/hooks/*.js`, `web/src/main.jsx`, `web/vite.config.js`, `supabase/migrations/...001_esquema.sql` (índices), `...002_vistas.sql`, `supabase/functions/_shared/{cola,reglas,destinatarios,resumen,items}.ts`.

## Datos de prueba (generadores SQL)
```sql
-- 1 200 ítems repartidos entre clientes, módulos y responsables existentes (requiere el plan importado)
with c as (select array_agg(id order by id) a from public.cliente),
     m as (select array_agg(id order by id) a from public.modulo),
     p as (select array_agg(id order by id) a from public.persona where tipo = 'equipo')
insert into public.item (codigo, funcionalidad, cliente_id, modulo_id, responsable_id, alcance, fase, estado, plan_fin, plan_pruebas_fin)
select 'QA-' || lpad(g::text, 5, '0'), 'Funcionalidad QA ' || g,
       c.a[1 + g % array_length(c.a, 1)], m.a[1 + g % array_length(m.a, 1)], p.a[1 + g % array_length(p.a, 1)],
       (array['Web','Mobile','Data'])[1 + g % 3], 'Desarrollo',
       (array['No iniciado','En curso','Terminado','Suspendido','Terminado, en etapa de pruebas'])[1 + g % 5],
       public.hoy() + (g % 60 - 30), public.hoy() + (g % 60 - 20)
from generate_series(1, 1200) g, c, m, p;

-- 4 notas por ítem de QA (≈ 4 800 notas)
insert into public.nota (item_id, tipo, texto, autor)
select i.id, (array['Seguimiento','Planificación','Ejecución','Reprogramación'])[1 + n % 4],
       'Nota QA ' || n || ' ' || repeat('texto ', 20), 'QA'
from public.item i, generate_series(1, 4) n where i.codigo like 'QA-%';

-- Limpieza
delete from public.item where codigo like 'QA-%';
```
Variantes: 300, 1 000, 1 001, 1 200, 5 000 ítems; 100 y 3 000 personas/alertas; 5 000 filas en `notificacion_log` y `auditoria`.

## Escenarios
| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| RN-01 | **Truncamiento de ítems** | Con 1 200 ítems abrir Centro de Mando, Backlog, Cronograma, Analítica, Equipo | Totales = 1 200 en todas partes; **si algún total marca 1 000, registrar el caso exacto** (`pages` y KPI afectados) |
| RN-02 | Truncamiento de notas | Con 4 800 notas: buscar texto de una nota antigua en Backlog; «reprogramaciones» del asistente; KPI «Reprogramaciones»; exportar Plan | Todas las notas deben considerarse; documentar cuáles se pierden y que el orden es arbitrario (`api/items.js:32` sin `order`) |
| RN-03 | Truncamiento del respaldo | Descargar respaldo con 1 200 ítems / 4 800 notas | El `.xlsx` debe contener todo; contar filas por hoja contra `select count(*)` |
| RN-04 | Truncamiento en el servidor | Con 1 200 ítems ejecutar `recordar` / `resumen` / `tick` | El resumen y los vencimientos consideran todos (ver `_shared/items.ts`) |
| RN-05 | Otros listados | 1 001 personas / ceremonias / acuerdos / bloqueos | Mismo análisis; registrar cada pantalla que se corte |
| RN-06 | Carga inicial | Lighthouse (móvil, 4G lento) en `/` con 300 y 1 000 ítems | LCP, TBT, INP y CLS documentados (objetivo orientativo: LCP < 2,5 s, INP < 200 ms) |
| RN-07 | Peso de red | Pestaña Network al abrir cada ruta | Tamaño y número de peticiones por página; identificar duplicadas (`items`, `notas`, `personas` repetidas) |
| RN-08 | Bundle | `npm run build` | Tamaño por chunk; verificar que las librerías pesadas no bloquean la primera pantalla |
| RN-09 | Render de tablas | Backlog con 1 000 filas; filtrar y escribir en la búsqueda | Sin bloqueo perceptible (> 100 ms por tecla); documentar ausencia de virtualización y de `debounce` |
| RN-10 | Gantt grande | Cliente con 500 ítems | Render < 2 s; desplazamiento fluido |
| RN-11 | Gantt con fechas extremas | Un ítem con año 2999 | No congela el navegador (H-17) |
| RN-12 | Gráficos | Analítica con 1 000 ítems | Interacción fluida; sin parpadeos al cambiar filtros |
| RN-13 | Consultas SQL | `explain (analyze, buffers) select * from v_item;` con 1 000, 5 000 y 20 000 ítems; también `v_persona`, `v_bloqueante_abierto` | Uso de índices adecuado; tiempos < 100 ms para 5 000 |
| RN-14 | Búsqueda de notas | `select item_id from nota where lower(texto) like '%x%'` (equivalente a la búsqueda del cliente) con 50 000 notas | Documentar escaneo secuencial; evaluar índice trigram |
| RN-15 | Importación pequeña | Excel de ejemplo (274 filas) | Tiempo total y de la RPC; debe terminar muy por debajo del `statement_timeout` |
| RN-16 | Importación grande | 1 000, 3 000, 5 000 filas | Registrar el punto en que aparece «canceling statement due to statement timeout»; confirmar reversión completa (H-08) |
| RN-17 | Importación repetida | Reimportar el mismo archivo grande | Tiempo de la actualización idempotente |
| RN-18 | Concurrencia en la app | 5 usuarios editando y consultando a la vez (script con `curl` o k6 sobre RPC `guardar_item` y `v_item`) | Sin errores 5xx; latencia p95 documentada |
| RN-19 | Ráfaga de guardados | 50 llamadas seguidas a `guardar_item` | Sin duplicados ni errores de unicidad |
| RN-20 | `tick` con muchos datos | 1 000 ítems abiertos, 200 ceremonias, 500 acuerdos, 100 personas | Duración de `revisar()`; contar consultas por alerta (patrón N+1 en `resolver`, `reglas.ts:127-162`) |
| RN-21 | `despachar` con cola grande | 300 pendientes con SMTP sandbox y con retardo artificial | Duración total vs límite de la función; qué ocurre al cortarse (H-11) |
| RN-22 | Tabla `notificacion_log` enorme | 200 000 filas | `Historial` y `Actividad` (limit 8/300) siguen rápidos; `contarAlertas` (conteos exactos) no degrada |
| RN-23 | Conteos exactos | `contarAlertas` con 500 000 filas en `alerta_programada` | Tiempo de los 3 `count: exact` |
| RN-24 | Memoria del navegador | 30 min navegando con 1 000 ítems y 5 000 notas | Sin crecimiento sostenido (pestaña Memory) |
| RN-25 | Caché y refetch | Cambiar de pestaña 10 veces | No dispara ráfagas de consultas innecesarias |
| RN-26 | Dispositivos modestos | CPU 4× más lenta (DevTools) | Usable; documentar tiempos |
| RN-27 | Arranque en frío de funciones | Primera llamada tras 15 min inactiva | Latencia documentada (cold start) |
| RN-28 | Cuota/limitaciones del plan | Alcanzar límites (conexiones, invocaciones) | Mensajes de error comprensibles |

## Puntos sospechosos
- `api/items.js:5-13,32,43-46`, `api/ceremonias.js:4,14`, `api/personas.js:3`: sin paginación ni `order` determinista en notas (H-03).
- `api/configuracion.js:41`: `.limit(50000)` engañoso (H-03).
- `features/backlog/useFiltrosBacklog.js:32-34`: filtra todas las notas en cada pulsación; `TablaBacklog.jsx:30` y `PestanaExportar.jsx:10` descargan todas las notas.
- `hooks/useAlertas.js` y `api/alertas.js:50-71`: `contarAlertas` hace 3 conteos exactos en cada refetch (también desde `ResumenLateral` en cada página).
- `_shared/destinatarios.ts:25-30`: cada llamada a `resolver` consulta `config` y toda `v_persona` activa.
- `_shared/reglas.ts:127-162`: por cada ceremonia y etiqueta se resuelven destinatarios y se construye la plantilla antes de comprobar la clave.
- `_shared/cola.ts:98-117`: envío secuencial sin lote ni límite.
- `...003_funciones.sql` `importar_plan`: transacción única con triggers de auditoría por fila (H-08).

## Evidencia a capturar
Capturas de DevTools (Network/Performance/Memory), informes de Lighthouse, planes `EXPLAIN`, scripts de carga y sus resultados (p50/p95/p99, errores), conteos SQL vs conteos de pantalla, versión y plan de Supabase, `max_rows` y `statement_timeout` configurados.

## Severidad y prioridad
Datos truncados sin aviso o respaldo incompleto = S2/P1. Importación que falla con volúmenes razonables = S2. Lentitud > 3 s en acciones frecuentes = S3. Optimización = S4.

## Formato de salida
| ID | Escenario | Volumen/entorno | Resultado y métrica | Evidencia | Bug (ID, S/P) |
Después: bugs con la plantilla `98`, tabla de resultados por volumen y recomendaciones (paginación por `range`, lotes de importación, `order` determinista, caché).
