# 10 · Pruebas de autenticación, autorización y RLS

> Copia todo este archivo como prompt. Prefijo de casos: **AU**. Ejecutar solo contra el proyecto de pruebas. Variables: `URL` = `https://<ref>.supabase.co`, `ANON` = clave publicable del frontend.

## Rol y mentalidad
Pentester/QA de seguridad que asume un atacante con **solo la clave pública** (está en el bundle) y otro con una cuenta válida pero sin privilegios especiales. Tu hipótesis de partida: «alguien sin sesión puede hacer más de lo debido». Documentas cada intento con la petición exacta y la respuesta.

## Contexto técnico
- Autenticación: Supabase Auth (email/contraseña), `web/src/context/AuthContext.jsx` (`signInWithPassword`, `onAuthStateChange`, `signOut`), `pages/Login.jsx`, guardia `RutaProtegida` en `App.jsx`. Sesión en `localStorage` (`sb-<ref>-auth-token`). Sin registro ni recuperación de contraseña en la UI.
- Autorización: RLS habilitado en las 17 tablas (`supabase/migrations/20261106000001_esquema.sql:209-225`). Políticas `acceso_autenticado` (`to authenticated using (true) with check (true)`) en config, producto, cliente, actividad, modulo, persona, persona_cliente, item, nota, bloqueante, ceremonia, acuerdo y regla_alerta; `alerta_programada` (select/update autenticados), `notificacion_log` y `auditoria` (solo select); `smtp_config` sin políticas (solo service role). Vistas `v_*` con `security_invoker = true`.
- Funciones SQL expuestas por RPC (`/rest/v1/rpc/<nombre>`): `guardar_item`, `eliminar_item`, `eliminar_ceremonia`, `guardar_persona`, `importar_plan`, `cancelar_alertas`, `siguiente_codigo`, `registrar_auditoria` (**SECURITY DEFINER**), `hoy`, auxiliares `_limpiar`, `_normalizar`, `_catalogo_id`, `_etiqueta_fecha`, `_formato_fecha`.
- Edge Functions: `alertas`, `correo`, `ia` con `verify_jwt = true` (`supabase/config.toml:12-20`); internamente usan el service role y **no** verifican al usuario.
- Registro público: `config.toml` (`enable_signup = false`) solo aplica en local; en remoto se apaga en el panel (`supabase/README.md:20-22`).

## Archivos a leer
`context/AuthContext.jsx`, `App.jsx`, `pages/Login.jsx`, `lib/supabase.js`, `supabase/config.toml`, `supabase/migrations/20261106000001_esquema.sql` (RLS) y `...003_funciones.sql`, `supabase/functions/*/index.ts`, `supabase/functions/_shared/supabase.ts`.

## Datos de prueba
Usuarios `qa.po@example.test` y `qa.po2@example.test`; un token caducado (esperar o cambiar la hora del sistema); el JWT anónimo (la clave `anon`); una copia manipulada del JWT.

## Escenarios
| ID | Escenario | Pasos / petición | Resultado esperado |
|---|---|---|---|
| AU-01 | Ruta protegida | Abrir `/backlog` sin sesión | Redirige a `/login`; no hay parpadeo con datos |
| AU-02 | Login correcto | Credenciales válidas | Entra a `/`; el botón atrás no vuelve a `/login` autenticado (redirige a `/`) |
| AU-03 | Login incorrecto | Contraseña mala / correo inexistente | Mensaje «Correo o contraseña incorrectos.» igual en ambos casos (sin enumeración de usuarios) |
| AU-04 | Usuario no confirmado | Cuenta sin confirmar | Mensaje de correo no confirmado |
| AU-05 | Fuerza bruta | 20 intentos seguidos | Aplica limitación de la plataforma (429); documentar el umbral |
| AU-06 | Cerrar sesión | «Cerrar sesión» | Vuelve a `/login`; el token desaparece de `localStorage` |
| AU-07 | Caché tras cerrar sesión | Cerrar sesión e iniciar con otro usuario sin recargar | No debe verse información previa (H-20: la caché de React Query no se limpia) |
| AU-08 | Cierre en otra pestaña | Cerrar sesión en A, actuar en B | B detecta y redirige (`onAuthStateChange`) |
| AU-09 | Token caducado | Dejar expirar (≤1 h) con la pestaña abierta | Refresco automático; si falla, redirige al login sin pantalla rota |
| AU-10 | Token manipulado | Editar un carácter del JWT en `localStorage` | Peticiones 401; la app no entra en bucle |
| AU-11 | `anon` lee tablas | `curl "$URL/rest/v1/item?select=*" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"` (repetir con las 17 tablas y las 5 vistas) | `[]` o 401/403; **ninguna fila** |
| AU-12 | `anon` escribe | `POST /rest/v1/item`, `PATCH`, `DELETE`, y `config` | 401/403 (RLS); sin cambios |
| AU-13 | `anon` llama RPC de negocio | `POST /rest/v1/rpc/guardar_item`, `importar_plan`, `eliminar_item` | Error de permisos/RLS; sin cambios |
| AU-14 | `anon` llama `registrar_auditoria` | `POST /rest/v1/rpc/registrar_auditoria` con `{"p_entidad":"x","p_accion":"forja","p_detalle":"prueba"}` | **Esperado: 401/403.** Hoy se sospecha 204 y fila falsa en `auditoria` (H-02) |
| AU-15 | `anon` llama funciones | `curl -X POST $URL/functions/v1/correo -H "Authorization: Bearer $ANON" -H "apikey: $ANON" -d '{"accion":"estado"}'` y lo mismo con `alertas` (`destinatarios`, `tick`) e `ia` | **Esperado: 401/403.** Hoy se sospecha 200 con datos (H-01) |
| AU-16 | Sin ningún token | Misma llamada sin `Authorization` | 401 |
| AU-17 | Token de otro proyecto | Usar un JWT válido de otro proyecto Supabase | 401 |
| AU-18 | `alg: none` / firma alterada | JWT forjado | 401 |
| AU-19 | Registro público | `curl -X POST $URL/auth/v1/signup -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"email":"intruso@example.test","password":"Intruso-2026!"}'` | 422/403 «Signups not allowed»; si crea usuario, es S1 (H-04) |
| AU-20 | Registro por OTP/enlace mágico | `POST /auth/v1/otp` con `create_user:true` | No crea usuarios nuevos |
| AU-21 | Autorización entre usuarios autenticados | Usuario 2 lee/edita datos del usuario 1 | Por diseño comparten todo; **documentar** y confirmar con el PO que es lo deseado (cualquier cuenta creada = acceso total) |
| AU-22 | Usuario autenticado y `smtp_config` | `GET /rest/v1/smtp_config` con sesión de PO | `[]` (sin política); la contraseña nunca aparece |
| AU-23 | Usuario autenticado manipula `auditoria`/`notificacion_log` | `POST`/`PATCH`/`DELETE` | 403 (solo `select`) |
| AU-24 | Usuario autenticado y `alerta_programada` | `PATCH` de `cuerpo_html`/`destinatarios`, `POST` | `PATCH` permitido (política update `true`): documentar riesgo de alterar destinatarios o contenido de un correo pendiente; `POST` denegado |
| AU-25 | Usuario autenticado edita `config` | Cambiar `app_url` a `javascript:alert(1)` o `po_correo` | Se permite (política abierta): documentar impacto en correos y alertas (H-04, H-15) |
| AU-26 | Vault | `select * from vault.decrypted_secrets` con rol `authenticated` (por RPC o SQL como ese rol) | Denegado |
| AU-27 | Cron | `select * from cron.job` como `authenticated` | Denegado |
| AU-28 | Service role en el bundle | Buscar `service_role`, `eyJ`, `SUPABASE_SERVICE` en `web/dist/**` | Solo aparece la clave anon/publicable |
| AU-29 | Almacenamiento de sesión | Inspeccionar `localStorage` | Solo tokens de Supabase; documentar riesgo de XSS (ver prompt 11) |
| AU-30 | Contraseña débil | Crear usuario con `123456` desde el panel | Documentar política mínima de la plataforma (6 caracteres) y recomendar endurecer |
| AU-31 | Funciones eliminadas | Buscar «Cerrar la aplicación» | No existe; `os._exit` no aplica |
| AU-32 | Recuperación de contraseña | Buscar enlace «¿Olvidaste tu contraseña?» | No existe: documentar el proceso manual (administrador) |

## Puntos sospechosos
- `supabase/functions/alertas/index.ts:125`, `correo/index.ts:84`, `ia/index.ts:9`: no hay `auth.getUser()`; `verify_jwt` acepta la clave `anon` (H-01).
- `supabase/migrations/...003_funciones.sql:32-37`: `registrar_auditoria` `SECURITY DEFINER` con `EXECUTE` por defecto a `PUBLIC` (H-02).
- `...001_esquema.sql:222-238`: políticas `using (true)`; `config` y `alerta_programada` editables por cualquier autenticado.
- `AuthContext.jsx:35`: `cerrarSesion` no limpia la caché de React Query (H-20).
- `AuthContext.jsx:22-30`: todo error de login se traduce igual salvo `invalid_credentials`/`email_not_confirmed`; verificar que no filtra mensajes crudos útiles para enumerar usuarios.
- `config.toml:5`: `enable_signup = false` no se aplica al proyecto remoto automáticamente (H-04).

## Evidencia a capturar
Comando exacto, código HTTP y cuerpo de cada respuesta; filas creadas en `auditoria`; captura de la configuración de Authentication; resultado de `select tablename, rowsecurity from pg_tables where schemaname='public'`.

## Severidad y prioridad
Cualquier acceso anónimo a datos o escritura = S1/P1. Funciones accesibles con la clave anon = S1/P1. Falsificación de auditoría = S2/P1. Política laxa documentada = S3 (decisión del PO).

## Formato de salida
| ID | Escenario | Petición/pasos | Resultado (PASA/FALLA) | Evidencia | Bug (ID, S/P) |
Después: bugs con la plantilla `98` y recomendaciones de mitigación (validar usuario en funciones, `revoke execute`, lista de usuarios permitidos).
