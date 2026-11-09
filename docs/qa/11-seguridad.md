# 11 · Pruebas de seguridad de la aplicación

> Copia todo este archivo como prompt. Prefijo de casos: **SE**. Solo en el proyecto de pruebas, con `dry_run = true` y SMTP sandbox. Complementa a `10-autenticacion-autorizacion-rls.md`.

## Rol y mentalidad
Auditor de seguridad de aplicaciones web (OWASP Top 10 / ASVS). Asumes un adversario motivado con la clave pública y, en un segundo escenario, con una cuenta válida. Priorizas lo explotable y demostrable; todo hallazgo lleva petición, respuesta e impacto.

## Contexto técnico
- Frontend React (sin `dangerouslySetInnerHTML`; el markdown del asistente se pinta con nodos React: `features/asistente/TextoMarkdown.jsx`). Vista previa de correos en `iframe sandbox=""` (`features/alertas/ColaEnvios.jsx:24`).
- Correo: `supabase/functions/_shared/plantilla.ts` escapa `& < > " '` en todos los textos y en la URL del botón; el asunto proviene de títulos/nombres del usuario. SMTP con `nodemailer`.
- SMTP: `smtp_config` (contraseña en texto plano; sin políticas). `correo/guardar` actualiza `host`, `puerto`, `seguridad`, `usuario`, `remitente`; `probar` y `prueba` conectan con la contraseña guardada.
- Funciones con service role sin verificación de usuario (H-01). CORS `*` (`_shared/cors.ts`). Errores 500 devuelven `error.message` (`_shared/respuesta.ts:19-20`).
- Datos libres: funcionalidad, descripción, notas, motivo de bloqueo, nombres de persona/cliente/actividad/módulo/producto, título/lugar/notas de ceremonia, acuerdos, `config.po_nombre`, `config.app_url`.
- Excel: `xlsx@0.18.5` (`web/package.json:20`) para leer/escribir.
- Modelo opcional: función `ia` (`IA_BASE_URL`, `IA_MODEL`, `IA_API_KEY`).

## Archivos a leer
`features/asistente/TextoMarkdown.jsx`, `features/alertas/ColaEnvios.jsx`, `supabase/functions/_shared/{plantilla,correo,destinatarios,cola,respuesta,cors,supabase,modelo}.ts`, `supabase/functions/correo/index.ts`, `alertas/index.ts`, `ia/index.ts`, `lib/excel/*`, `web/package.json`, `web/index.html`.

## Datos de prueba
Cadenas de ataque: `<script>alert(1)</script>`, `"><img src=x onerror=alert(1)>`, `javascript:alert(1)`, `'; drop table item;--`, `%0d%0aBcc: x@example.test`, `{{7*7}}`, `=HYPERLINK("http://example.test","x")`, cadenas de 1 MB, Unicode bidireccional (`‮`), valores nulos. Un servidor SMTP «atacante» local (por ejemplo `python -m smtpd`/Mailpit con registro de AUTH).

## Escenarios
| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| SE-01 | XSS almacenado en cada campo libre | Insertar `"><img src=x onerror=alert(1)>` en cada campo (UI y por SQL) | Se ve como texto en todas las pantallas, tooltips (`title`), gráficos (etiquetas del Gantt y recharts), toasts y asistente; sin ejecución |
| SE-02 | XSS en nombres de catálogo | Cliente/actividad con HTML | Idem en filtros, `ComboField` (`datalist`), Gantt y exportación |
| SE-03 | XSS en el HTML del correo | Ítem, persona y ceremonia con HTML en todos los campos; generar cada alerta | La plantilla muestra el texto escapado; verificar el HTML crudo en la cola y en el buzón sandbox |
| SE-04 | URL del botón del correo | `config.app_url = javascript:alert(1)` y `https://x"onmouseover="…` | La comilla se escapa; el esquema `javascript:` se documenta como riesgo (validar `http(s)` al guardar) |
| SE-05 | Inyección de cabeceras en el asunto | Título con `\r\nBcc: …` | El correo no gana destinatarios ni cabeceras |
| SE-06 | Vista previa aislada | Insertar por SQL un `cuerpo_html` con `<script>`, `<meta refresh>`, `<form>`, `<iframe>` | El `sandbox=""` bloquea scripts, formularios, navegación y popups |
| SE-07 | Inyección en filtros de PostgREST | Valores con `,`, `)`, `.`, `*`, `%`, `or=` en `item_ids` de `recordar` y en `bloqueante_id` de `escalar` | Sin errores de sintaxis explotables ni resultados de más; entradas no numéricas devuelven 400/500 controlado |
| SE-08 | SQL injection por RPC | JSON con comillas en `p_data` de `guardar_item`/`importar_plan` | Sin ejecución (consultas parametrizadas); `_catalogo_id` rechaza tablas fuera de la lista |
| SE-09 | Exposición de `smtp_config` | Con sesión de PO: `GET /rest/v1/smtp_config`; `correo/estado`; red y consola | `[]`; la contraseña no aparece en ninguna respuesta, log ni DOM |
| SE-10 | Exfiltración de la contraseña SMTP | Con la clave `anon`: `correo/guardar` cambiando `host` a tu servidor (seguridad `none`) y luego `correo/probar` | **Esperado: 401/403 antes de poder hacerlo.** Hoy se sospecha éxito y captura de usuario/contraseña en tu servidor (H-01) |
| SE-11 | Correos no autorizados | Con `anon`: `correo/prueba` a una dirección propia (con envío real en sandbox); `alertas/tick`; `alertas/resumen` | Denegado (H-01) |
| SE-12 | Cambio de modo | Con `anon`: `correo/modo {"dry_run":false}` | Denegado (H-01) |
| SE-13 | Fuga de directorio | Con `anon`: `alertas/destinatarios` con `regla_codigo` | Denegado; no debe listar nombres ni correos |
| SE-14 | SSRF/escaneo | Con sesión válida: `guardar` con `host` interno (`127.0.0.1`, `169.254.169.254`, `10.0.0.1`) y puertos varios; `probar` | Documentar si se puede escanear la red del proveedor por tiempos/mensajes de error; recomendar lista de hosts permitidos |
| SE-14b | Validaciones de `guardar` | `host` vacío/`undefined`, `usuario` nulo, `nombre_remitente` 1 MB | Rechazo con 400; sin cadenas «undefined» guardadas |
| SE-15 | Abuso del modelo | `ia/redactar` con `historial` de 10 000 mensajes y rol `system` | Debe limitar tamaño y roles (H-18); con `anon`, denegado |
| SE-16 | Secretos en el bundle | `npm run build`; buscar en `web/dist` `service_role`, `SMTP`, `password`, `IA_API_KEY` y mapas de fuente | Solo URL y clave publicable; sin `.map` publicados |
| SE-17 | Repositorio | Buscar `.env`, claves, correos reales | `.env` ignorado; semillas con datos reales documentadas (H-15) |
| SE-18 | Cabeceras HTTP del hosting | `curl -I <app>` | Documentar ausencia/presencia de CSP, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, HSTS (el repositorio no las define) |
| SE-19 | Clickjacking | Incrustar la app en un `iframe` externo | Debe impedirse con cabeceras (recomendar `frame-ancestors 'none'`) |
| SE-20 | CORS de las funciones | `OPTIONS` y `POST` con `Origin: https://evil.example` | Hoy `*` (H-19); tras corregir la autenticación, restringir al origen de la app |
| SE-21 | Exposición de errores | Provocar un 500 (cuerpo mal formado, id inexistente) | El mensaje no debe revelar SQL, rutas ni nombres internos |
| SE-22 | Dependencias | `cd web && npm audit` y revisar `xlsx` | Listar vulnerabilidades; probar un `.xlsx` malicioso (ReDoS/prototype pollution) y medir cuelgue (H-22) |
| SE-23 | Inyección de fórmulas al exportar | Texto `=1+1`, `+cmd`, `@SUM(1)` en campos | En el `.xlsx` quedan como texto (tipo `s`); verificar al abrir en Excel |
| SE-24 | Control de acceso por función | Llamar `alertas/escalar`, `recordar`, `invitar_ceremonia` con ids inexistentes/de otro estado | Error controlado; sin efectos |
| SE-25 | Repudio y auditoría | Realizar acciones sensibles (activar envío real, cambiar SMTP) | Existe rastro; `guardar` del SMTP **no** deja auditoría: documentar |
| SE-26 | Almacenamiento local | Inspeccionar `localStorage`/`sessionStorage`/IndexedDB | Solo la sesión de Supabase; sin datos de negocio |
| SE-27 | Fuga por URL/Referer | Revisar si algún token o dato sensible aparece en URLs o consultas | Ninguno |
| SE-28 | Enumeración de usuarios | Respuestas de login y de errores | Mensajes uniformes |
| SE-29 | Rate limiting | 200 llamadas/min a `prueba`, `tick`, `ia` | Documentar la ausencia de límites propios (H-01 los hace explotables) |
| SE-30 | Contenido bidireccional | Nombre con `‮` | No debe invertir el texto de la UI de forma engañosa en tablas críticas (destinatarios) |

## Puntos sospechosos
- `alertas/index.ts:125`, `correo/index.ts:84`, `ia/index.ts:9` sin autenticación de usuario; `correo/index.ts:24-41` permite cambiar `host` sin la contraseña (H-01).
- `_shared/plantilla.ts:38`: `href` escapado pero sin validar esquema.
- `_shared/respuesta.ts:19-20`: devuelve el mensaje de error interno al cliente.
- `_shared/cors.ts:2`: `Access-Control-Allow-Origin: *`.
- `correo/index.ts:63-72` (`cambiarModo`) audita; `guardar` no.
- `...003_funciones.sql:32-37`: `registrar_auditoria` invocable por `anon` (H-02).
- `smtp_config.password` en texto plano (H-10).
- `web/package.json:20`: `xlsx@0.18.5` (H-22).

## Evidencia a capturar
Petición/respuesta completas (curl o pestaña Network), captura del DOM sin ejecución, correo crudo (cabeceras y HTML) del buzón sandbox, log del servidor SMTP «atacante», salida de `npm audit`, cabeceras del hosting.

## Severidad y prioridad
Ejecución de scripts, exfiltración de secretos o acceso anónimo a funciones = S1/P1. Ausencia de cabeceras de seguridad y CORS abierto = S3/P2. Mensajes de error con detalles internos = S3.

## Formato de salida
| ID | Escenario | Petición/pasos | Resultado (PASA/FALLA) | Evidencia | Bug (ID, S/P) |
Después: bugs con la plantilla `98` (incluye CVSS orientativo) y un plan de mitigación priorizado.
