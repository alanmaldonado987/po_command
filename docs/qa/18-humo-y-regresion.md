# 18 · Humo post-despliegue y regresión

> Copia todo este archivo como prompt. Prefijo de casos: **HU**. El humo debe poder ejecutarse en ≤ 20 minutos tras cada despliegue.

## Rol y mentalidad
Responsable de liberación: tu trabajo es decir «go / no-go» con evidencia rápida. Primero verificas que el entorno está bien armado (migraciones, funciones, cron, configuración segura) y luego recorres los flujos críticos.

## Contexto técnico
- Pipeline mínimo del frontend (`web/`): `npm run lint`, `npm test` (Vitest: `src/features/asistente/motor/responder.test.js`, `src/lib/excel/excel.test.js`), `npm run build`. Playwright (`npm run test:e2e`) puede existir en `web/e2e` si el equipo lo ha añadido.
- Backend: 4 migraciones (`supabase db push`), funciones `alertas correo ia` (`supabase functions deploy`), `supabase/cron.sql` + secretos Vault `project_url`, `service_role_key`, ajustes de Authentication (registro desactivado), `config.app_url`, `config.po_correo`, `smtp_config.dry_run`.
- Variables del frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (`web/.env`, no versionado).
- Puntos de fallo conocidos: despliegue de funciones (importaciones `npm:`), clave publicable vs `verify_jwt`, `max_rows` de PostgREST, semillas con datos reales (H-15).

## Archivos a leer
`supabase/README.md`, `supabase/cron.sql`, `supabase/config.toml`, `web/package.json`, `web/.env.example`, `docs/qa/hallazgos-iniciales.md`.

## Datos de prueba
Entorno de destino recién desplegado con el plan de ejemplo importado y el usuario PO de prueba.

## A. Verificaciones de entorno (SQL/CLI)
| ID | Verificación | Cómo | Esperado |
|---|---|---|---|
| HU-01 | Migraciones aplicadas | `supabase migration list` o `select version from supabase_migrations.schema_migrations order by 1;` | Las 4 versiones `20261106000001…04` |
| HU-02 | RLS activo en todo | `select tablename, rowsecurity from pg_tables where schemaname='public' order by 1;` | `rowsecurity = true` en las 17 tablas |
| HU-03 | Políticas | `select tablename, policyname, cmd, roles from pg_policies where schemaname='public' order by 1;` | Coinciden con `...001_esquema.sql:222-241`; `smtp_config` sin políticas |
| HU-04 | Funciones expuestas | `select p.proname, has_function_privilege('anon', p.oid, 'execute') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1;` | `anon` sin `execute` salvo lo deliberado (hoy `registrar_auditoria` aparece: H-02) |
| HU-05 | Funciones desplegadas | `supabase functions list` | `alertas`, `correo`, `ia` activas con la versión esperada |
| HU-06 | Respuesta de funciones | `curl -X POST $URL/functions/v1/alertas -H "Authorization: Bearer <JWT de usuario>" -d '{"accion":"despachar"}'` | `{enviadas, fallidas}` con 200; con acción desconocida, 400 |
| HU-07 | Funciones sin sesión | Misma llamada con la clave `anon` y sin token | Debe ser 401/403 (AU-15; hoy se sospecha 200) |
| HU-08 | Cron | `select jobname, schedule, active from cron.job;` y `select status, start_time from cron.job_run_details order by start_time desc limit 5;` | `po-alertas-tick`, `*/15 * * * *`, activo, últimas ejecuciones correctas |
| HU-09 | Vault | `select name from vault.decrypted_secrets;` (rol `postgres`) | `project_url`, `service_role_key` presentes; no accesibles para `authenticated` |
| HU-10 | Registro público | Panel Authentication → Providers → Email, o prueba `curl` de signup (AU-19) | Desactivado |
| HU-11 | Usuario PO | Authentication → Users | Solo usuarios previstos, confirmados |
| HU-12 | Configuración inicial | `select * from config;` | `po_nombre`, `po_correo` y `app_url` correctos para el entorno (no `localhost` ni correo ajeno) |
| HU-13 | Modo de correo | `select host, puerto, seguridad, usuario, dry_run from smtp_config;` | `dry_run` según lo acordado; credenciales de producción solo en producción |
| HU-14 | Reglas | `select codigo, activa, parametro, hora_envio from regla_alerta order by id;` | 8 reglas con los valores acordados |
| HU-15 | `max_rows` y timeouts | Panel API (Max rows) y `show statement_timeout` bajo el rol `authenticated` | Valores documentados; ver prompt 14 |
| HU-16 | Variables del frontend | Inspeccionar el bundle desplegado | URL y clave del entorno correctos; sin `service_role` (AU-28) |
| HU-17 | Construcción | `cd web && npm ci && npm run lint && npm test && npm run build` | Todo en verde |
| HU-18 | HTTPS y cabeceras | `curl -I <app>` | HTTPS, HSTS; ver SE-18 |

## B. Humo funcional (≈ 15 min)
| ID | Flujo | Pasos | Esperado |
|---|---|---|---|
| HU-20 | Inicio de sesión | Login con el PO | Entra al Centro de Mando sin errores de consola |
| HU-21 | Datos visibles | Ver KPIs y listas | Coinciden con la base |
| HU-22 | Backlog | Crear ítem → editarlo → cambiar fecha planificada → bloquear → desbloquear | Bitácora con 3 notas automáticas; alertas simuladas en cola |
| HU-23 | Importación | Subir el Excel de ejemplo (en un entorno vacío) | 274 filas, 152 notas |
| HU-24 | Cronograma | Abrir un cliente | Gantt dibujado |
| HU-25 | Ceremonias | Crear una y «Enviar invitación» | Alerta en cola; el toast no promete envío real si es simulación |
| HU-26 | Equipo | Editar el correo de una persona | Se guarda y se refleja en destinatarios |
| HU-27 | Alertas | «Revisar reglas y enviar ahora» | Respuesta sin error; contadores cambian |
| HU-28 | Correo | `Guardar y probar conexión` + correo de prueba al buzón sandbox | Llega con plantilla correcta |
| HU-29 | Asistente | «¿Qué está atrasado?» | Respuesta con datos reales |
| HU-30 | Exportar y respaldar | Descargar Plan y respaldo | Archivos abren y contienen todas las filas |
| HU-31 | Cerrar sesión | Salir y entrar | Correcto |

## C. Regresión (por riesgo)
| Suite | Casos | Cuándo |
|---|---|---|
| Crítica (P1) | AU-11…AU-20, SE-09…SE-13, DB-04…DB-11, DB-31…DB-32, MA-02…MA-06, MA-28…MA-30, CF-19…CF-24, BL-13…BL-21 | Cada release |
| Alta | CM-01…CM-12, BL-22…BL-38, CE-08…CE-11, EQ-08…EQ-18, AL-03…AL-12, AN-02…AN-06, IA-02…IA-09 | Cada release con cambios en esas áreas |
| Media | CR-xx, UX-01…UX-12, RC-01…RC-12 | Mensual o antes de hitos |
| Automatizada | `npm test`, Playwright (si existe) | En cada commit |
Tras corregir un bug, añadir su caso a la suite crítica con el ID del bug.

## Puntos sospechosos
- `supabase/migrations/...004_semillas.sql:3-4`: correo real y `localhost` en datos sembrados (H-15).
- `supabase/cron.sql`: depende de dos secretos manuales en Vault; si faltan, el programador falla en silencio.
- Despliegue de funciones: importaciones `npm:` y `verify_jwt` con claves publicables.
- `supabase/config.toml`: `enable_signup=false` no se propaga al proyecto remoto (H-04).

## Evidencia a capturar
Salida de cada consulta/comando, capturas del panel, resultado de `npm ci/lint/test/build`, versión desplegada (commit), hora y responsable.

## Severidad y prioridad
Cualquier fallo de HU-02, HU-04, HU-07, HU-10, HU-12 o HU-13 es bloqueante (S1/P1). Un fallo en el humo funcional (B) bloquea la liberación.

## Formato de salida
| ID | Verificación/flujo | Resultado (PASA/FALLA) | Evidencia | Bug (ID, S/P) |
Al final: decisión **GO / NO-GO** con la lista de bloqueantes y de riesgos aceptados.
