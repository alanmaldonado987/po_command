# 12 · Integridad de datos, transacciones y reglas de negocio

> Copia todo este archivo como prompt. Prefijo de casos: **DB**. Ejecutar en el SQL Editor del proyecto de pruebas (rol `postgres`) y, donde se indique, como usuario `authenticated` desde la app o con `curl`. Usar `begin; … rollback;` cuando se quiera inspeccionar sin dejar rastro.

## Rol y mentalidad
QA senior de bases de datos: no te fías de la interfaz. Compruebas invariantes con SQL, fuerzas errores a mitad de una operación para ver si queda estado a medias y ejecutas operaciones en paralelo desde dos sesiones.

## Contexto técnico
- Esquema: `supabase/migrations/20261106000001_esquema.sql` (tablas, `check`, `unique`, índices parciales), `...002_vistas.sql` (`v_item`, `v_bloqueante_abierto`, `v_ceremonia`, `v_acuerdo`, `v_persona`), `...003_funciones.sql` (RPC y triggers), `...004_semillas.sql`.
- Reglas clave:
  - `v_item.atraso_dias`: sin `fecha_compromiso` → 0; `Terminado` → `max(coalesce(fecha_entrega, fecha_compromiso) − fecha_compromiso, 0)`; `Suspendido` → 0; resto → `max(hoy(Bogotá) − fecha_compromiso, 0)`. `fecha_compromiso = coalesce(plan_pruebas_fin, plan_fin)`; `fecha_entrega = coalesce(real_pruebas_fin, real_fin)`. `atrasado = estado ∉ (Terminado, Suspendido) ∧ atraso_dias > 0`.
  - `guardar_item`: fusiona el JSON sobre la fila existente (`jsonb_populate_record`), normaliza texto, exige `funcionalidad`, fija `terminado_en`, registra notas «Cambio de fechas · …» (solo las 4 fechas planificadas), gestiona `bloqueante` (índice único parcial `bloqueante_abierto_ux` = un bloqueo abierto por ítem), cancela `BLOQUEO_ESCALAR` al desbloquear, devuelve `sin_cambios` y no escribe si nada cambió.
  - Borrado lógico: `eliminar_item` (`eliminado_en`), `v_item` filtra eliminados; `eliminar_ceremonia` cancela alertas y borra.
  - Auditoría: triggers `auditar_*` en item, persona, ceremonia, producto, cliente, actividad, modulo (crear/editar/eliminar; `item` con `eliminado_en` → `eliminar`); `registrar_auditoria` para importación y cambios de modo de correo.
  - `importar_plan`: una transacción; clave `clave_importacion`; notas deduplicadas por texto normalizado; crea personas de equipo sin correo.
  - Códigos `BL-nnn` por la secuencia `item_codigo_seq`.
- Claves externas: `item.*_id` → `on delete set null`; `persona_cliente` → cascada; `nota`, `bloqueante` → cascada con el ítem; `acuerdo.ceremonia_id`/`responsable_id` → `set null`.

## Archivos a leer
Las 4 migraciones completas; `web/src/api/items.js`, `api/personas.js`, `api/catalogos.js`; `features/backlog/valoresFormulario.js`.

## Datos de prueba
Plan importado; dos sesiones SQL abiertas (A y B); dos pestañas de la app con usuarios distintos.

## Escenarios
| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| DB-01 | Fórmula de atraso | Ítems con cada combinación (sin fecha, Terminado con/sin entrega, Suspendido, abierto vencido/no vencido); `select codigo, estado, fecha_compromiso, fecha_entrega, atraso_dias, atrasado from v_item where …` | Coincide con la fórmula; sin valores negativos |
| DB-02 | Límite del día | `plan_pruebas_fin = hoy` y `= hoy − 1` | 0 y 1 días; frontera con la hora de Bogotá (probar entre 19:00 y 24:00 locales de Bogotá) |
| DB-03 | `terminado_en` | Pasar a Terminado con/sin `real_pruebas_fin`/`real_fin`; reabrir; volver a terminar | Primero usa la fecha real; si ya era Terminado conserva la existente; al reabrir queda `null` |
| DB-04 | Reprogramación por RPC | `select guardar_item('{"plan_fin":"2026-12-31"}', <id>)` | Nota automática «Cambio de fechas · fin planificado: a → b»; `cambios` en la respuesta; **no** genera nota si cambian solo fechas reales |
| DB-05 | Rango invertido | `select guardar_item('{"plan_ini":"2026-12-31","plan_fin":"2026-01-01"}', <id>)` | Esperado: rechazo; hoy se acepta (H-17) |
| DB-06 | Fechas absurdas | `{"plan_fin":"0202-01-01"}`, `{"plan_fin":"9999-12-31"}`, `{"plan_fin":"no-es-fecha"}` | Rechazo o límite razonable; la última debe fallar con un error entendible |
| DB-07 | Sin cambios | Guardar dos veces el mismo contenido | La 2.ª devuelve `sin_cambios:true`; `actualizado_en`, notas y auditoría no cambian |
| DB-08 | Bloqueo | `guardar_item('{"bloqueado":true,"motivo_bloqueo":"x"}', id)` | Un `bloqueante` abierto, severidad `Alta` si hay atraso, nota «Bloqueado: x» |
| DB-09 | Bloqueo repetido | Repetir con otro motivo | Actualiza el motivo del mismo bloqueante; sigue habiendo uno solo abierto |
| DB-10 | Un bloqueo abierto por ítem | `insert into bloqueante (item_id, motivo) …` dos veces para el mismo ítem | La segunda viola `bloqueante_abierto_ux` |
| DB-11 | Desbloqueo | `{"bloqueado":false}` | `resuelto_en`, nota «Bloqueo resuelto: …», alertas `BLOQUEO_ESCALAR` pendientes → `Cancelada` |
| DB-12 | Bloqueo sin motivo por API | `{"bloqueado":true}` | Motivo «Motivo pendiente: complétalo en el backlog» (confirmar que es intencional) |
| DB-13 | Funcionalidad vacía | `{"funcionalidad":"   "}` | Excepción «La funcionalidad es obligatoria» |
| DB-14 | Catálogo en línea | `{"cliente":"nuevo"}`, `{"cliente":"NUEVO"}`, `{"cliente":"  nuevo  "}` | Un único cliente (comparación sin mayúsculas, espacios normalizados) |
| DB-15 | Estado inválido | `{"estado":"Cualquiera"}` | Violación de `check` |
| DB-16 | Códigos | 20 altas seguidas; borrar una | Códigos únicos, crecientes, con huecos (la secuencia no revierte) |
| DB-17 | Altas concurrentes | Dos sesiones llamando `guardar_item` a la vez 50 veces | Sin códigos repetidos ni errores de unicidad |
| DB-18 | Ediciones concurrentes | A y B editan el mismo ítem (A: `descripcion`, B: `alcance`) con `for update` y pausa | Se serializan; **última escritura gana en todos los campos que el cliente envía** (H-12): documentar |
| DB-19 | Borrado lógico | `eliminar_item(id)` | `eliminado_en` poblado; `v_item` y alertas lo ignoran; bloqueos cerrados; `nota` conservadas; devuelve nº de alertas canceladas |
| DB-20 | Eliminar dos veces | Repetir | Excepción «El ítem n no existe» |
| DB-21 | Reutilización de clave | Importar de nuevo tras eliminar un ítem importado | Se crea uno nuevo (la búsqueda ignora eliminados) |
| DB-22 | Auditoría de ítems | Crear/editar/eliminar | Tres filas; el detalle «BL-nnn funcionalidad»; ediciones sin cambios no auditan |
| DB-23 | Auditoría de catálogos y personas | CRUD | Una fila por operación con nombre |
| DB-24 | Auditoría inmutable | Como `authenticated`: `update`/`delete` sobre `auditoria` | Denegado |
| DB-25 | `registrar_auditoria` por `anon` | Ver AU-14 | Debe denegarse (H-02) |
| DB-26 | Cascadas | Borrar un cliente con ítems, personas, ceremonias | Ítems y ceremonias con `cliente_id null`; `persona_cliente` eliminado; sin errores de FK |
| DB-27 | Borrar persona | Con ítems abiertos y acuerdos | `responsable_id null` en ambos |
| DB-28 | Borrar producto | Con módulos e ítems | `producto_id null` en ambos |
| DB-29 | `guardar_persona` atómica | Pasar un `cliente_id` inexistente | Falla y no deja la persona a medias |
| DB-30 | `recibe` y valores | `recibe` con categoría inexistente o duplicada | Documentar (no hay `check`); efecto en el resolver |
| DB-31 | Importación atómica | Insertar en el JSON una fila con fecha inválida en la posición 100 | Toda la importación se revierte (0 ítems nuevos, 0 notas, 0 personas) |
| DB-32 | Importación idempotente | Dos veces el mismo archivo | 2.ª vez: `sin_cambios = n`, sin notas ni auditoría extra por ítem |
| DB-33 | Importación y bloqueos | Ítem con bloqueo, reimportar con otro estado | Conserva bloqueo y descripción |
| DB-34 | Clave nula | `importar_plan` con filas sin `clave` | No debe crear duplicados en cada llamada (hoy la comparación con `null` nunca coincide) |
| DB-35 | Dedupe de notas | Importar nota con espacios/acentos distintos | No se duplica (comparación normalizada) |
| DB-36 | Zona horaria de `hoy()` | `select public.hoy(), now()` a las 23:30 y 00:30 Bogotá | `hoy()` cambia a medianoche de Bogotá, no de UTC |
| DB-37 | Restricciones de alertas | `insert` de dos alertas con la misma `clave_unica`; `estado` inválido; `hora_envio` `25:00` | `unique`, `check` y `check` respectivamente |
| DB-38 | `parametro` sin límites | `update regla_alerta set parametro = -5` | Se acepta (sin `check`): impacto en el prompt 13 (H-13) |
| DB-39 | Triggers de `actualizado_en` | Editar persona/producto/ítem | `actualizado_en` cambia |
| DB-40 | Consistencia vista/tabla | `select count(*)` de `item` (no eliminados) vs `v_item` | Iguales; `v_bloqueante_abierto` = bloqueos abiertos de ítems no eliminados |
| DB-41 | Integridad de ceremonias | `duracion_min = 0`, `audiencia` inválida | Violación de `check` |
| DB-42 | Datos sembrados | Revisar `config`, `smtp_config`, 8 reglas | Presentes y con los valores esperados; `po_correo` y `app_url` por entorno (H-15) |

## Puntos sospechosos
- `...003_funciones.sql` (`update public.item set …` dentro de `guardar_item`, ~línea 214-225): reemplaza todas las columnas editables sin versión (H-12).
- `...001_esquema.sql` (tabla `item`): sin `check` de orden de fechas ni de rango de años (H-17); `regla_alerta.parametro` sin `check` (H-13).
- `...003_funciones.sql` (`importar_plan`, desde ~línea 310): `clave_importacion = v_fila ->> 'clave'` con `null` no empareja (DB-34); una sola transacción (H-08).
- `...003_funciones.sql:32-37`: `registrar_auditoria` expuesta (H-02).
- `eliminar_ceremonia` primero cancela alertas y luego borra, pero no audita las alertas canceladas.
- `v_item` calcula `titulo` con `' · completo'`; confirmar que filtros y búsquedas por título usan el campo correcto (`funcionalidad` vs `titulo`).

## Evidencia a capturar
Script SQL ejecutado y su salida, `select` de las filas antes/después, planes `EXPLAIN` si procede, capturas de las dos sesiones en el caso de concurrencia.

## Severidad y prioridad
Estado a medias tras un error, pérdida de datos o duplicados = S1/S2 (P1). Constraint ausente sin pérdida inmediata = S3/P2.

## Formato de salida
| ID | Escenario | SQL/pasos | Resultado (PASA/FALLA) | Evidencia | Bug (ID, S/P) |
Después: bugs con la plantilla `98` y las migraciones sugeridas (checks, revokes, versión de fila).
