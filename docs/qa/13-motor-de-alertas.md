# 13 · Motor de alertas (Edge Functions, cola, tiempos y cron)

> Copia todo este archivo como prompt. Prefijo de casos: **MA**. Entorno de pruebas con `smtp_config.dry_run = true` (los envíos quedan como «Simulado…») y, para casos de SMTP real, buzón sandbox. Ejecutar `tick` con el botón «Revisar reglas y enviar ahora» o con `curl` (clave `service_role` solo en el proyecto de pruebas).

## Rol y mentalidad
QA senior de procesos en segundo plano: el tiempo es tu variable principal. Fabricas estados con SQL (retrocediendo fechas), ejecutas `tick` varias veces y verificas que cada alerta salga **una sola vez**, en el momento y con los destinatarios correctos, en zona America/Bogota.

## Contexto técnico
- Funciones: `supabase/functions/alertas/index.ts` (acciones `tick`, `despachar`, `item_guardado`, `escalar`, `resumen`, `recordar`, `invitar_ceremonia`, `destinatarios`), `correo`, `ia`. Código compartido en `_shared/` (`reglas.ts`, `cola.ts`, `eventos.ts`, `destinatarios.ts`, `plantilla.ts`, `resumen.ts`, `tiempo.ts`, `correo.ts`).
- `tick = revisar() + despachar()`. Programador: `supabase/cron.sql` (`*/15 * * * *`, `pg_net.http_post` con secretos de Vault `project_url` y `service_role_key`).
- Reglas del motor (`reglas.ts`):
  - **BLOQUEO_ESCALAR** (`revisarEscalamientos`): bloqueo abierto con `abierto_en ≤ ahora − parametro` (48 h; `Number(parametro) || 48`) y (`escalado_en` nulo o ≤ ahora − 24 h) → clave `ESC:{id}:{fecha Bogotá}`; asunto `[Escalamiento] CODIGO cliente bloqueado Nh`; actualiza `bloqueante.escalado_en` si se encoló.
  - **VENCIMIENTO** (`revisarVencimientos`): ítems abiertos con `fecha_compromiso ≤ hoy + parametro` (2 días); excluye «Terminado, en etapa de pruebas» sin `plan_pruebas_fin`; un correo por responsable (grupo `null` = sin responsable), clave `VEN:{resp|0}:{fecha}`, hasta 40 filas, `enviar_en = aLaHora(hora_envio)`.
  - **CEREMONIA** (`revisarCeremonias`): ceremonias futuras; «previo» si falta ≤ `parametro` h (24) y «1h» si falta ≤ 1 h; clave `CER:{id}:{previo|1h}:{fecha_hora}`; destinatarios `audiencia` + PO.
  - **ACUERDO_VENCIDO**: acuerdos no `Cumplido` con `fecha_limite < hoy`; clave `ACU:{id}` (una vez en la vida del acuerdo); `enviar_en = aLaHora(hora_envio)`.
  - **RESUMEN_SEMANAL**: solo si hoy (Bogotá) es lunes; clave `RES:{año ISO}-{semana ISO}`; `enviar_en = aLaHora(hora_envio)`.
  - Eventos desde la app (`eventos.ts`): **BLOQUEO_NUEVO** (al bloquear), **BLOQUEO_RESUELTO** (al desbloquear; los escalamientos pendientes los cancela la RPC), **REPROGRAMACION** (si `cambios.length > 0`). Sin clave única.
- Cola (`cola.ts`): `encolar` (sin destinatarios → log `Omitida`; clave repetida → no inserta), `despachar` (pendientes con `enviar_en ≤ ahora`, `reservar` empuja `enviar_en` +10 min con comparación exacta, envía, `registrarResultado`; 3 intentos → `Fallida`; cada intento deja fila en `notificacion_log`).
- Tiempo (`tiempo.ts`): `hoy()` en Bogotá, `aLaHora` usa desfase fijo `-05:00`, `esLunes`, `semanaIso`.
- Destinatarios (`destinatarios.ts`): roles `responsable`, `po`, `equipo`, `stakeholders` (por cliente), `lider_tecnico`, `audiencia`; `recibe` vacío = todo; sin correo válido → PO.

## Archivos a leer
Todo `supabase/functions/**`, `supabase/cron.sql`, tabla `regla_alerta` y `alerta_programada` en `...001_esquema.sql`, `web/src/api/alertas.js`.

## Datos de prueba y utilidades SQL
```sql
-- Bloqueo de 49 h sin escalar
update public.bloqueante set abierto_en = now() - interval '49 hours', escalado_en = null where id = <id>;
-- Escalado hace 25 h
update public.bloqueante set escalado_en = now() - interval '25 hours' where id = <id>;
-- Ceremonia en 50 minutos / en 20 horas / en 30 horas
update public.ceremonia set fecha_hora = now() + interval '50 minutes' where id = <id>;
-- Acuerdo vencido
update public.acuerdo set fecha_limite = (public.hoy() - 1), estado = 'Pendiente' where id = <id>;
-- Ítem que vence mañana / vencido sin responsable
update public.item set plan_fin = public.hoy() + 1, estado = 'En curso' where id = <id>;
-- Limpiar para repetir
delete from public.alerta_programada where regla_codigo = '<REGLA>';
-- Resultado
select id, regla_codigo, estado, clave_unica, enviar_en, intentos, left(asunto,60) asunto, destinatarios from public.alerta_programada order by id desc;
select fecha, regla_codigo, estado, detalle from public.notificacion_log order by id desc limit 30;
```
Personas: responsable con correo, stakeholder del cliente, líder técnico, persona sin correo, persona inactiva, PO con correo.

## Escenarios
| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| MA-01 | Humo del `tick` | Ejecutar `tick` con la base sembrada | `{creadas, enviadas, fallidas}` sin errores |
| MA-02 | Envío efectivo (reserva) | Dejar una alerta `Pendiente` con `enviar_en` pasado y ejecutar `despachar` | `Enviada`, `enviado_en` poblado, log «Simulado: …»; confirma que `reservar` empareja el `enviar_en` y que NO quedan pendientes sin enviar |
| MA-03 | Escalamiento a 48 h | Bloqueo con 49 h | 1 alerta `BLOQUEO_ESCALAR` (clave `ESC:id:fecha`), destinatarios stakeholders del cliente + líder técnico + PO; `escalado_en` actualizado |
| MA-04 | Escalamiento a 47 h | Bloqueo con 47 h | Ninguna alerta |
| MA-05 | Repetición a 24 h | Escalado hace 25 h y nueva clave de día | Nuevo escalamiento; con escalado hace 23 h, ninguno |
| MA-06 | Misma ejecución repetida | `tick` dos veces seguidas | Segunda: 0 creadas (clave única); sin filas «Omitida» nuevas por casos con destinatarios |
| MA-07 | Parámetro de regla | Cambiar a 72 h / 0 / -5 / texto | 72 respeta; 0 → usa 48; **-5 → escala todos los bloqueos** (H-13, documentar) |
| MA-08 | Regla inactiva | Desactivar `BLOQUEO_ESCALAR` | Sin escalamientos |
| MA-09 | Sin destinatarios | Quitar stakeholders, líder y PO | `notificacion_log` «Omitida»; verificar que NO se acumula una fila nueva en cada `tick` (hoy sí, H-07) y que `escalado_en` no se actualiza |
| MA-10 | Vencimientos por responsable | 3 ítems vencidos de A y 2 por vencer de B | 2 alertas (una por responsable) con conteos «N vencido(s) y M por vencer» y atraso en días |
| MA-11 | Horario del vencimiento | `tick` a las 02:00 Bogotá y a las 10:00 | 02:00 → `enviar_en` hoy 08:00; 10:00 → `enviar_en` inmediato |
| MA-12 | Una vez por día | `tick` varias veces | 1 alerta por responsable y día (`VEN:resp:fecha`); al día siguiente nueva |
| MA-13 | Más de 40 ítems | 45 vencidos de un responsable | 40 filas + «y 5 más en el backlog» |
| MA-14 | Sin responsable | Ítems vencidos sin responsable | Sin destinatarios (rol `responsable` vacío) → «Omitida» cada ejecución (H-07) |
| MA-15 | Excepción de pruebas | Ítem `Terminado, en etapa de pruebas` con y sin `plan_pruebas_fin` | Sin fin de pruebas no vence; con fin vencido sí |
| MA-16 | Vencidos eternos | Ítem vencido hace 90 días | Sigue incluido cada día (diseño heredado); documentar |
| MA-17 | Ceremonia «previo» | Ceremonia en 20 h | 1 alerta `CEREMONIA` clave `CER:id:previo:fecha`, destinatarios según audiencia + PO |
| MA-18 | Ceremonia «1h» | En 50 min | Alertas «1h» (y «previo» si no existía): comprobar si salen **dos correos a la vez** y valorarlo |
| MA-19 | Ceremonia fuera de ventana | En 30 h / pasada | Ninguna |
| MA-20 | Cambio de hora de ceremonia | Mover de 20 h a 22 h tras el aviso | Nueva clave (incluye `fecha_hora`): comprobar que el aviso antiguo no se envíe con datos viejos |
| MA-21 | Acuerdo vencido | Acuerdo con `fecha_limite` ayer | 1 alerta (`ACU:id`) para responsable y PO a las 08:00; no se repite al día siguiente (documentar si es lo esperado) |
| MA-22 | Acuerdo cumplido o sin fecha | Revisar | Sin alerta |
| MA-23 | Resumen semanal en lunes | Ejecutar `tick` un lunes (o simular con la prueba Deno de abajo) | 1 alerta `RES:{año}-{semana}` a PO y stakeholders, `enviar_en` 07:30 |
| MA-24 | Resumen en otro día | Martes | Ninguna |
| MA-25 | Frontera horaria del lunes | Domingo 23:30 Bogotá (lunes 04:30 UTC) y lunes 00:30 Bogotá | Domingo → no; lunes → sí (usa `hoy()` de Bogotá, no UTC) |
| MA-26 | Semana ISO | 2026-12-28 (semana 53 de 2026), 2027-01-04 (semana 1 de 2027), 2026-01-01 | Claves `RES:2026-53`, `RES:2027-1`, `RES:2026-1` |
| MA-27 | Contenido del resumen | Revisar HTML | Avance por cliente, terminados 7 días, vencidos, reprogramaciones 7 días, bloqueantes (3), próximas ceremonias (3) correctos vs SQL |
| MA-28 | `item_guardado` bloqueo nuevo | Bloquear desde la app | `BLOQUEO_NUEVO` a responsable, PO, stakeholders del cliente; mensaje con nº de destinatarios |
| MA-29 | `item_guardado` desbloqueo | Desbloquear | `BLOQUEO_RESUELTO` encolada; escalamientos pendientes `Cancelada` |
| MA-30 | `item_guardado` reprogramación | Cambiar `plan_fin` | `REPROGRAMACION` con las filas «Fin planificado: a → b» |
| MA-31 | Bloqueo y reprogramación juntos | Mismo guardado | Dos alertas; mensaje combinado |
| MA-32 | Evento perdido | Guardar bloqueo y cortar la red antes de `item_guardado` | El ítem queda bloqueado sin alerta; documentar (H-06) |
| MA-33 | `escalar` manual | Botón «Escalar» ×3 | 3 alertas (sin clave); `ok:true` |
| MA-34 | `recordar` | Acción del asistente | Una por responsable; segunda vez el mismo día → 0 y mensaje «Hoy ya se había enviado…» |
| MA-35 | Invitación | `invitar_ceremonia` dos veces | Dos alertas (clave con `Date.now()`); `invitacion_enviada = true` |
| MA-36 | Destinatarios: `recibe` vacío | Persona sin categorías | Recibe todo (H-16) |
| MA-37 | Destinatarios: stakeholders por cliente | Stakeholder de otro cliente | No recibe |
| MA-38 | Destinatarios: sin correo | Responsable sin correo | Sustituido por el PO con nombre «(en lugar de …, sin correo)»; sin PO con correo → sin destinatarios |
| MA-39 | Destinatarios: duplicados | Mismo correo en 2 roles/personas (distinta capitalización) | Un solo envío |
| MA-40 | Líder técnico | Rol «TECH LEAD», «Líder técnico» | Detectado sin distinguir mayúsculas |
| MA-41 | Reintentos | `smtp_config.dry_run=false` con SMTP caído | Intento 1 y 2 → `Pendiente` con `error` y `enviar_en` +10 min; intento 3 → `Fallida`; 3 filas `Fallida` en el log |
| MA-42 | Recuperación | Corregir SMTP y «Reintentar» una `Fallida` | Pasa a `Enviada` (intentos reiniciados) |
| MA-43 | Doble `despachar` simultáneo | Dos llamadas a la vez con 20 pendientes | Cada alerta se envía una sola vez (reserva) |
| MA-44 | Función interrumpida | Matar la función tras enviar y antes de `registrarResultado` (simular con timeout) | Documentar el reenvío (H-11) |
| MA-45 | Cola grande | 300 pendientes y SMTP lento | Medir duración; la función no debe exceder el límite de tiempo de Supabase; documentar (H-11) |
| MA-46 | Cron | `select * from cron.job; select * from cron.job_run_details order by start_time desc limit 5; select * from net._http_response order by created desc limit 5;` | Existe `po-alertas-tick` cada 15 min; ejecuciones con estado 200 |
| MA-47 | Cron sin secretos | Borrar `service_role_key` de Vault | Fallo visible en `net._http_response`; sin crash silencioso; documentar |
| MA-48 | Cron caído 48 h | Desactivar y reactivar | Al volver, no debe inundar con alertas antiguas (revisar vencimientos y ceremonias pasadas) |
| MA-49 | Plantilla | Revisar HTML de cada alerta | Escapado, colores por tipo, botón «Abrir PO Command» con `config.app_url` correcta (H-15) |
| MA-50 | Idioma/zonas en texto | Ceremonia a las 08:00 Bogotá | El correo muestra la hora de Bogotá (`formatoLocal`), no la del navegador de quien la creó (H-09) |
| MA-51 | Modo simulación | `dry_run = true` | Alertas `Enviada` con detalle «Simulado»; ningún mensaje real |
| MA-52 | Auditoría de acciones | Activar envío real | Fila en `auditoria` |

Prueba Deno rápida de fechas (opcional, desde `supabase/functions`): importar `_shared/tiempo.ts` y comprobar `esLunes(new Date("2026-11-09T05:30:00Z")) === true`, `esLunes(new Date("2026-11-09T04:30:00Z")) === false` (domingo 23:30 en Bogotá), `semanaIso("2026-12-28")` → `{anio:2026, semana:53}`.

## Puntos sospechosos
- `_shared/cola.ts:29-40`: `Omitida` se registra antes de revisar la clave única → una fila por `tick` (H-07). `reglas.ts:104-117`: un bloqueo sin destinatarios nunca fija `escalado_en` y se reevalúa en cada ejecución.
- `_shared/reglas.ts:17`: `Number(parametro) || defecto` trata los negativos como válidos (H-13).
- `_shared/reglas.ts:127-162`: no filtra ceremonias por estado ni por `invitacion_enviada`; cada `tick` ejecuta `resolver` y `plantilla` por cada ceremonia y etiqueta antes de comprobar la clave (coste N×).
- `_shared/reglas.ts:138-147`: «previo» y «1h» pueden salir en la misma ejecución para ceremonias creadas con menos de 1 h de antelación.
- `_shared/cola.ts:62-73`: `reservar` compara `enviar_en` por igualdad textual; cualquier diferencia de formato impediría enviar. `cola.ts:98-117`: despacho secuencial sin tope (H-11).
- `_shared/tiempo.ts:5,45`: desfase fijo `-05:00` (válido hoy porque Colombia no usa horario de verano).
- `alertas/index.ts:90`: la clave de invitación usa `Date.now()` (múltiples reenvíos).
- `features/backlog/FormularioItem.jsx:35-42` y `features/centro/BloqueantesActivos.jsx:58-59`: el aviso depende del cliente (H-06).
- `supabase/migrations/...004_semillas.sql:4`: `app_url` apunta a `localhost` (H-15).

## Evidencia a capturar
Salida de `select` sobre `alerta_programada` y `notificacion_log` tras cada paso, cuerpo de respuesta de cada acción de `alertas`, HTML del correo, `cron.job_run_details`, `net._http_response`, logs de la función (panel Edge Functions) y tiempos de ejecución.

## Severidad y prioridad
Alerta duplicada, perdida o a destinatarios equivocados = S1/S2 (P1). Inundación del log o frecuencia incorrecta = S2/S3. Texto de correo = S4.

## Formato de salida
| ID | Escenario | Preparación SQL | Resultado (PASA/FALLA) | Evidencia | Bug (ID, S/P) |
Después: bugs con la plantilla `98` y tres recomendaciones.
