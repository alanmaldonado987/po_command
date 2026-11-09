# Hallazgos iniciales (revisión estática del código)

Resultado de leer `web/src` y `supabase/` sin ejecutar la app. Cada hallazgo es una **hipótesis a confirmar** con los prompts del paquete (columna «Prompt»). Severidad: **Crítica** (explotable ya, impacto grave), **Alta**, **Media**, **Baja**. Las líneas corresponden al estado actual del repositorio.

## Resumen priorizado

| ID | Sev. | Hallazgo | Prompt |
|---|---|---|---|
| H-01 | Crítica | Las Edge Functions no comprueban quién llama: con la clave `anon` (pública en el bundle) se puede leer/cambiar la configuración SMTP, enviar correos y filtrar la contraseña SMTP | 10, 11, 13 |
| H-02 | Alta | `registrar_auditoria` es `SECURITY DEFINER` y ejecutable por `anon` vía `/rpc`: se puede falsificar la auditoría | 10, 11, 12 |
| H-03 | Alta | Listados sin paginación: PostgREST corta en 1000 filas; el respaldo y las exportaciones se truncan en silencio | 14, 09, 12 |
| H-04 | Alta | El registro público debe estar desactivado a mano; si no, cualquiera obtiene rol `authenticated` y acceso total (políticas `using (true)`) | 10 |
| H-05 | Media | Muchas mutaciones sin `try/catch`: ante un error no hay mensaje y queda una promesa rechazada sin tratar | 02, 04, 05, 06, 19 |
| H-06 | Media | Los avisos de bloqueo/reprogramación dependen de que el navegador llame a `item_guardado` después de la RPC (sin outbox ni trigger) | 13, 12, 19 |
| H-07 | Media | `encolar` registra «Omitida» en cada ejecución cuando no hay destinatarios: ~96 filas/día por regla/grupo | 13, 14 |
| H-08 | Media | `importar_plan` corre en una sola transacción desde el navegador; puede exceder el `statement_timeout` de `authenticated` | 09, 14 |
| H-09 | Media | Zona horaria incoherente: el navegador usa su hora local; la base y las funciones usan America/Bogota | 03, 04, 13, 16 |
| H-10 | Media | Contraseña SMTP en texto plano en `smtp_config` | 11 |
| H-11 | Media | `despachar` secuencial y sin límite; riesgo de exceder el tiempo de la función y de duplicar envíos | 13, 14 |
| H-12 | Media | Ediciones concurrentes: gana la última escritura, sin control de versión | 12 |
| H-13 | Media | Parámetros de reglas sin validar (valores negativos disparan avisos continuos) y hora inválida reemplazada en silencio | 06, 13 |
| H-14 | Media | Accesibilidad: filas de tabla clicables sin teclado, popovers sin teclado, Gantt sin alternativa textual | 15 |
| H-15 | Baja | `app_url` y `po_correo` sembrados con `localhost` y un correo real | 18, 06 |
| H-16 | Baja | `recibe = []` significa «recibe todo» (contraintuitivo) | 05, 13 |
| H-17 | Baja | Fechas absurdas o rangos invertidos se aceptan en el servidor; el Gantt puede congelarse | 03, 12 |
| H-18 | Baja | `ia` acepta `historial` y `pregunta` sin límite ni validación de roles | 08, 11 |
| H-19 | Baja | CORS `*` en las funciones | 11 |
| H-20 | Baja | La sesión se cierra pero la caché de React Query sigue en memoria | 10 |
| H-21 | Baja | Mensajes engañosos en modo simulación («Invitación enviada…») | 04, 06 |
| H-22 | Baja | `xlsx@0.18.5` con vulnerabilidades conocidas al leer archivos no confiables | 09, 11 |
| H-23 | Baja | Fecha de la alerta mostrada con el día UTC y la hora local | 01, 16 |
| H-24 | Baja | `crypto.randomUUID()` falla en HTTP no seguro (toasts, asistente, acuerdos) y los iconos dependen de Google Fonts | 16, 15 |

## Detalle

### H-01 · Crítica · Funciones sin autorización de usuario
- `supabase/functions/alertas/index.ts:125-130`, `correo/index.ts:84-89`, `ia/index.ts:9-24`: ninguna llama a `auth.getUser()`; todas operan con el cliente `admin` (service role, `_shared/supabase.ts:3`).
- `supabase/config.toml:12-20`: `verify_jwt = true` solo valida la firma del JWT. La clave `anon` es un JWT válido y viaja en el bundle del frontend. Con claves nuevas `sb_publishable_…` la puerta de enlace puede rechazar la llamada y alguien desplegará con `--no-verify-jwt`, lo que elimina incluso esa barrera.
- Impacto concreto con solo la clave pública: `correo`/`estado` (host, usuario, remitente), `correo`/`guardar` (cambiar `host` a un servidor propio y luego `probar`: la función autentica contra ese servidor con la contraseña guardada y la **entrega**), `correo`/`prueba` (enviar correo arbitrario desde el remitente corporativo), `correo`/`modo` (activar el envío real), `alertas`/`tick`/`resumen` (disparar correos al equipo), `alertas`/`destinatarios` (filtra nombres y correos), `ia` (consumo de tokens).
- Sugerencia: validar `Authorization` con `admin.auth.getUser(token)` y exigir usuario autenticado (o service role solo para `tick`); restringir `guardar` a no cambiar `host`/`usuario` sin reingresar la contraseña.

### H-02 · Alta · `registrar_auditoria` invocable por cualquiera
- `supabase/migrations/20261106000003_funciones.sql:32-37`: función `SECURITY DEFINER` sin `REVOKE EXECUTE`. En Supabase las funciones del esquema `public` quedan expuestas en `/rest/v1/rpc/...` y `PUBLIC` tiene `EXECUTE` por defecto.
- Impacto: `anon` puede insertar filas arbitrarias en `auditoria` (falsificación de la bitácora de auditoría).
- Sugerencia: `revoke execute on function public.registrar_auditoria from public, anon, authenticated; grant execute ... to service_role;`. Revisar las demás funciones de `public` (`hoy`, `siguiente_codigo`, `_catalogo_id`, etc.) con la misma lente.

### H-03 · Alta · Truncamiento por `max_rows` de PostgREST
- `web/src/api/items.js:5-13` (`listarItems`), `:32` (`listarTodasLasNotas`, además **sin `order`**), `:43-46` (bloqueantes), `api/ceremonias.js:4,14`, `api/personas.js:3`: sin `.range()` ni paginación. El máximo por defecto de Supabase es 1000 filas.
- `web/src/api/configuracion.js:41`: `.limit(50000)` no supera el tope del servidor; el respaldo (`BotonRespaldo`) y «Exportar todas las tablas» pueden quedar **incompletos sin avisar**.
- `web/src/features/backlog/TablaBacklog.jsx:30,34` y `useFiltrosBacklog.js:32-34`: la exportación del Plan y la búsqueda por texto de notas usan `useTodasLasNotas`; con >1000 notas se pierden notas arbitrarias. `features/asistente/useAsistente.js:22` igual (reprogramaciones de 7 días).
- Edge: `_shared/items.ts:7-13`, `resumen.ts:37` (`v_item` completo) con el mismo límite.
- Hoy: 274 ítems y ~150 notas (no truncan aún). Las notas crecerán más rápido que los ítems.

### H-04 · Alta · Registro público y políticas abiertas
- `supabase/config.toml:5` solo aplica al entorno local o a `supabase config push`. En el proyecto remoto el interruptor «Allow new users to sign up» se apaga a mano (`supabase/README.md:20-22`). Si se olvida, cualquier visitante crea cuenta y obtiene `authenticated`.
- `supabase/migrations/20261106000001_esquema.sql:222-238`: políticas `to authenticated using (true) with check (true)` en casi todas las tablas, incluida `config` (puede cambiar `po_correo`, `app_url`).
- Sugerencia: lista de usuarios permitidos (tabla `usuario_permitido` + política) o claim de rol; documentar la comprobación en el checklist de despliegue.

### H-05 · Media · Mutaciones sin manejo de errores
Sin `try/catch` ni `onError` (el rechazo queda sin tratar y la UI no informa):
`pages/Alertas.jsx:33`, `features/ceremonias/FormularioCeremonia.jsx:46`, `DetalleCeremonia.jsx:46,51`, `EditorAcuerdos.jsx:72-75`, `features/equipo/EditorPersona.jsx:66,77`, `features/alertas/TarjetaRegla.jsx:20,65`, `FormularioSmtp.jsx:44-46`, `ActivacionEnvio.jsx:42,48`, `ColaEnvios.jsx:44,49`, `features/centro/AvisoInicio.jsx:15`.
Casos de prueba: cortar red, forzar 401/500, violar una restricción y observar el comportamiento.
Relacionado: `EditorAcuerdos` usa `Promise.all` (`:72-75`); un fallo parcial deja el estado mezclado, y `pages/Ceremonias.jsx:61` remonta el editor cuando cambian los ids (puede descartar filas sin guardar).

### H-06 · Media · Avisos dependientes del cliente
`features/backlog/FormularioItem.jsx:35-42` y `features/centro/BloqueantesActivos.jsx:58-59`: la RPC `guardar_item` confirma el cambio y **después** el navegador llama a `alertas/item_guardado`. Si el navegador se cierra, hay un corte de red o la función falla, el bloqueo o la reprogramación queda guardado **sin alerta** (en el formulario, el fallo solo se menciona en el toast). No hay reintento ni outbox.
Sugerencia: encolar el evento dentro de `guardar_item` (tabla `evento_item`) y que `tick` lo procese.

### H-07 · Media · Inundación de registros «Omitida»
`supabase/functions/_shared/cola.ts:29-40` registra `Omitida` **antes** de comprobar la clave única (`:41`). `reglas.ts:56-101` (`avisarVencimientos`) y `:104-117` (escalamientos) vuelven a evaluar los mismos casos en cada `tick` (cada 15 min): un ítem vencido sin responsable o un bloqueo sin destinatarios válidos genera ~96 filas/día en `notificacion_log`, que además falsea «Alertas por regla» (`features/analitica/metricas.js:59-66`) y el historial.

### H-08 · Media · Importación en una transacción
`features/configuracion/PestanaImportar.jsx:58,67` envía todas las filas en una sola llamada a `importar_plan` (`...003_funciones.sql:310-413`), que por fila ejecuta `guardar_item` + triggers de auditoría + notas. El rol `authenticated` suele tener `statement_timeout` ≈ 8 s. Con 274 filas está cerca; con planes mayores fallaría y revertiría todo. Sugerencia: lotes de ~50 filas con progreso.

### H-09 · Media · Zonas horarias
- Navegador: `lib/fechas.js:13` (`hoyIso`), `:52-58` (`aInputDateTime`/`desdeInputDateTime`) usan la hora local del usuario.
- Servidor: `public.hoy()` (`...001_esquema.sql:3-4`) y `_shared/tiempo.ts` usan America/Bogota.
- Efectos: «por vencer» en el Centro de Mando (`CentroMando.jsx`, `lib/dominio.js:itemsPorVencer`) frente al atraso calculado en la vista; la hora de una ceremonia se guarda según la zona del navegador pero el correo la muestra en Bogotá (`alertas/index.ts:77`).

### H-10 · Media · Contraseña SMTP en texto plano
`supabase/migrations/...001_esquema.sql` tabla `smtp_config.password text`. Solo el service role la lee (sin políticas), pero cualquier dump, log o función con `select *` la expone (`_shared/correo.ts:20-21`). Sugerencia: Vault (`vault.secrets`) o secretos de la función.

### H-11 · Media · Despacho secuencial y sin tope
`_shared/cola.ts:98-117`: recorre todas las pendientes una por una; cada envío puede tardar hasta 30 s por los timeouts (`correo.ts:33-35`). Con cientos de alertas la función se corta a medias. `reservar` (`:62-73`) empuja `enviar_en` 10 min, así que lo interrumpido se reintenta tarde; si la función muere tras enviar y antes de `registrarResultado` (`:111-112`) el correo se reenvía.

### H-12 · Media · Sobrescritura silenciosa
`features/backlog/valoresFormulario.js:54-70` envía el registro completo y `guardar_item` (`...003_funciones.sql:~214-225`) actualiza todas las columnas sin comparar `actualizado_en`. Dos sesiones (o dos pestañas) editando el mismo ítem pierden cambios sin aviso.

### H-13 · Media · Parámetros de regla
- `features/alertas/TarjetaRegla.jsx:25`: una hora inválida se cambia a `08:00` sin avisar.
- `NumberField` sin `min`; `regla_alerta.parametro` sin `check`. `_shared/reglas.ts:17` (`Number(parametro) || defecto`): un valor negativo es «verdadero» y adelanta el límite → `revisarEscalamientos` escalaría todos los bloqueos en cada ejecución.

### H-14 · Media · Accesibilidad
- `components/ui/DataTable.jsx:55-60`: `<tr onClick>` sin `tabIndex`, `role` ni `onKeyDown`; la tabla del Backlog (flujo principal) no se maneja con teclado.
- `components/ui/Popover.jsx`, `forms/MultiSelectField.jsx`: sin `aria-expanded`, sin Escape, sin foco gestionado. `Modal.jsx`: sin trampa de foco.
- `components/charts/GanttChart.jsx:37-47,81`: barras sin alternativa textual; el detalle va solo en `title`.
- Verificar contraste de `text-ink-muted` (#64748B) sobre `bg-line-soft` (#F1F5F9) y de textos de 11 px (`Kpi.jsx`, `Sidebar.jsx`).

### H-15 · Baja · Semillas
`...004_semillas.sql:3-4`: `po_correo = vrodriguez@ises.com.co` (correo real) y `app_url = http://localhost:5173`: los correos llevan un enlace roto en producción y, en un entorno de pruebas con envío real, escriben a una persona real.

### H-16 · Baja · `recibe` vacío
`_shared/destinatarios.ts:22-23`: `recibe.length === 0 || recibe.includes(categoria)`. Una persona que desmarca todas las categorías en `EditorPersona.jsx` recibe **todas** las alertas.

### H-17 · Baja · Fechas absurdas
`valoresFormulario.js:44` valida orden solo en el cliente; `guardar_item` y la tabla `item` no tienen `check` de rangos ni de años. Un año 0202 o 9999 hace que `GanttChart.jsx:10-30` calcule anchos enormes y un bucle de marcas muy largo.

### H-18 · Baja · `ia` sin validación
`ia/index.ts:16-20` y `_shared/modelo.ts:38-46`: `historial` se reenvía tal cual (roles `system` inyectables, tamaño ilimitado) y `pregunta` no tiene tope.

### H-19 · Baja · CORS abierto
`_shared/cors.ts:2`: `Access-Control-Allow-Origin: *`. Aceptable con autenticación real; restringir al dominio de la app.

### H-20 · Baja · Caché tras cerrar sesión
`context/AuthContext.jsx:35` no llama a `queryClient.clear()`. Tras volver a iniciar sesión sin recargar se muestran datos en caché del usuario anterior hasta el refetch.

### H-21 · Baja · Mensajes en simulación
`features/ceremonias/DetalleCeremonia.jsx:47` («Invitación enviada…») y los resultados de `tick` no distinguen modo simulación; el usuario cree que salió un correo.

### H-22 · Baja · Dependencia
`web/package.json:20`: `xlsx@0.18.5` (SheetJS en npm) con avisos de ReDoS y contaminación de prototipo al leer libros no confiables (`lib/excel/leerPlan.js:139`). Riesgo bajo con archivos propios; relevante si se importan archivos de terceros.

### H-23 · Baja · Fecha UTC con hora local
`features/centro/ProximasAlertas.jsx:12` usa `formatoFecha(enviar_en)` (parte de fecha del ISO en UTC) junto a `formatoHora` (hora local): entre las 19:00 y las 24:00 de Bogotá el día mostrado es el siguiente.

### H-24 · Baja · Contexto no seguro y dependencia de fuentes externas
- `web/src/context/ToastContext.jsx:11`, `features/asistente/useAsistente.js:61,69,73`, `features/ceremonias/EditorAcuerdos.jsx:18` usan `crypto.randomUUID()`, que solo existe en contextos seguros (HTTPS o `localhost`). Abrir la app por `http://<IP-de-la-LAN>` (o en un hosting sin HTTPS) rompe los avisos, el chat y las filas nuevas de acuerdos.
- `web/index.html:8-16`: Inter y los iconos (Material Symbols) vienen de Google Fonts. Si la red corporativa los bloquea, los iconos se ven como texto («space_dashboard», «report»…) y desbordan botones y menú.

## Cosas bien resueltas (para no perder tiempo)
- No hay `dangerouslySetInnerHTML`; el markdown del asistente se renderiza como nodos React (`TextoMarkdown.jsx`).
- La vista previa del correo usa `iframe sandbox=""` y la plantilla escapa HTML (`_shared/plantilla.ts:6`).
- No se interpolan filtros de PostgREST con texto del usuario; el cliente usa `.eq/.in` tipados.
- Las vistas usan `security_invoker`; `smtp_config` no tiene políticas para `authenticated`.
- Índice único parcial `bloqueante_abierto_ux` evita dos bloqueos abiertos por ítem; claves únicas de alertas evitan duplicados con ejecuciones simultáneas del cron.
