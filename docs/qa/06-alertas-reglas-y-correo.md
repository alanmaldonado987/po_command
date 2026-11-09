# 06 · Prueba funcional: Alertas & Notificaciones (`/alertas`) — reglas, cola y SMTP

> Copia todo este archivo como prompt. Prefijo de casos: **AL**. Usa SOLO un SMTP sandbox; mantén `dry_run = true` salvo en los casos que lo exigen.

## Rol y mentalidad
QA senior de mensajería: piensas en credenciales, en el paso de simulación a envío real, en reintentos y en lo que ve el usuario cuando el proveedor SMTP falla.

## Contexto técnico
- Página `web/src/pages/Alertas.jsx`: `TarjetaCorreo` (`FormularioSmtp`, `ActivacionEnvio`, `ResultadoCorreo`), `KpisAlertas`, botón «Revisar reglas y enviar ahora» (`alertas/tick`), 8 `TarjetaRegla` (interruptor Activa + popover «Ajustar»), `ColaEnvios`, `HistorialAlertas` (300 filas).
- Función `correo` (`supabase/functions/correo/index.ts`): `estado`, `guardar {valores}`, `probar`, `prueba {destino}` (envío real forzado), `modo {dry_run}`. Config en tabla `smtp_config` (una fila; sin políticas para `authenticated`; contraseña en texto plano). Validaciones: seguridad ∈ starttls/ssl/none, puerto entero 1–65535, destino con formato de correo. Contraseña vacía conserva la guardada. `explicarError` traduce 5.7.139/SMTP AUTH, 535, timeouts/DNS, 5.7.60.
- Proveedores predefinidos (`lib/constantes.js` `PROVEEDORES_CORREO`): Office 365 (smtp.office365.com:587 starttls), Gmail (smtp.gmail.com:587 starttls), Otro.
- Activar envío real: se habilita solo tras un correo de prueba exitoso en la misma sesión y marcar la casilla de confirmación. «Volver a modo simulación» es inmediato. Cada cambio de modo se registra en `auditoria` (`correo`/`activar|desactivar`).
- Reglas (`regla_alerta`): BLOQUEO_NUEVO, BLOQUEO_RESUELTO, BLOQUEO_ESCALAR (48 h), VENCIMIENTO (2 días, 08:00), REPROGRAMACION, CEREMONIA (24 h), ACUERDO_VENCIDO (08:00), RESUMEN_SEMANAL (07:30). Campos editables: activa, destinatarios (`responsable, po, equipo, stakeholders, lider_tecnico, audiencia`), `parametro`, `hora_envio` (`HH:MM`, con `check` en la tabla).
- Cola (`alerta_programada`): estados Pendiente/Enviada/Fallida/Cancelada; 3 intentos; cancelar (solo Pendiente) y reintentar (Fallida/Cancelada) se hacen con `update` directo desde el cliente; reintentar luego llama a `despachar`.
- Vista previa: `iframe sandbox="" srcDoc` con `cuerpo_html`.

## Archivos a leer
`pages/Alertas.jsx`, `features/alertas/*`, `hooks/useAlertas.js`, `hooks/useCorreo.js`, `api/alertas.js`, `api/correo.js`, `supabase/functions/correo/index.ts`, `_shared/correo.ts`, `_shared/cola.ts`.

## Datos de prueba
Cuenta sandbox (Mailtrap/Mailpit); alertas en cada estado; una alerta con HTML largo; personas con y sin correo y con dominio `@empresa.co`; credenciales SMTP válidas e inválidas.

## Escenarios
| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| AL-01 | Estado inicial | Abrir con base nueva | Insignia «Correo en simulación»; formulario con valores por defecto de Office 365 |
| AL-02 | Cambiar proveedor | Elegir Gmail y luego Otro | Gmail rellena host/puerto/seguridad; «Otro» conserva lo escrito |
| AL-03 | Guardar y probar (válido) | Credenciales del sandbox | Éxito «Conexión correcta con … como …»; contraseña no vuelve al navegador (`password_guardada: true`) |
| AL-04 | Credenciales inválidas | Contraseña errónea | Alerta de error con explicación en español (535) + detalle técnico |
| AL-05 | Host inexistente | `smtp.invalido.test` | Explicación de conexión (timeout/DNS) sin colgar la UI más de ~30 s |
| AL-06 | Puerto/seguridad inválidos | Puerto 0, 70000, vacío | Error claro del servidor («Puerto no válido») y visible |
| AL-07 | Contraseña vacía | Guardar sin escribirla | Se conserva la anterior (probar sigue funcionando) |
| AL-08 | Correo de prueba real | Destino válido | `ok` + sufijo «Revisa tu bandeja…»; llega al buzón sandbox con la plantilla |
| AL-09 | Destino inválido | `abc` | Error «El correo de destino no es válido» |
| AL-10 | Activar envío real | Sin prueba / con prueba / con casilla | Deshabilitado sin prueba exitosa y sin casilla; al activar: toast y `dry_run=false`; auditoría registrada |
| AL-11 | Avisos del directorio | Personas `@empresa.co` y sin correo | Advertencias con hasta 5 nombres y «…» |
| AL-12 | Volver a simulación | Pulsar | Inmediato; auditoría «desactivar» |
| AL-13 | Recarga tras probar | Recargar la página | La prueba exitosa se pierde y hay que repetirla para activar (confirmar y documentar) |
| AL-14 | Seguridad de la contraseña | Inspeccionar red/DOM/almacenamiento | La contraseña no aparece en respuestas de `estado`, ni en el DOM, ni en `localStorage` |
| AL-15 | KPIs | Comparar con SQL | Reglas activas (barra), En cola, Enviadas hoy, Fallidas |
| AL-16 | Revisar ahora | Pulsar | Toast «Revisión completa: n nuevas, n enviadas, n fallidas»; cola/KPIs se actualizan; error visible si falla la función (hoy no, H-05, `Alertas.jsx:33`) |
| AL-17 | Activar/desactivar regla | Conmutar | Persiste; chips cambian de color; una regla inactiva no genera alertas en el siguiente `tick` |
| AL-18 | Ajustar destinatarios | Cambiar roles | Persisten; el siguiente evento usa los nuevos |
| AL-19 | Parámetro con unidad | Editar 48→72 h en escalamiento | Texto «· 72 horas bloqueada» |
| AL-20 | Parámetro inválido | Negativo, decimales, vacío | Documentar: negativo adelanta alertas (H-13); vacío = 0 |
| AL-21 | Hora de envío | `8:30`, `25:00`, `08:30` | `08:30` válido; inválidas se reemplazan por `08:00` sin avisar (H-13) |
| AL-22 | Sin destinatarios en regla | Quitar todos los roles | Se guarda; el motor registrará «Omitida» (prompt 13) |
| AL-23 | Descripción/categoría | Revisar tarjetas | Texto, categoría, parámetro y hora (si ≠ 00:00) correctos |
| AL-24 | Falla al actualizar regla | Cortar red | Error visible (hoy no, H-05) |
| AL-25 | Interruptor sin etiqueta oculta | Revisar lector de pantalla | Una sola etiqueta «Activa» comprensible |
| AL-26 | Todas las reglas | Revisar las 8 | Íconos y textos coinciden con los códigos |
| AL-27 | Cola por estado | Cambiar entre los 4 estados | Lista por estado, orden por `enviar_en` desc, máx. 200 |
| AL-28 | Cancelar seleccionadas | Seleccionar 2 pendientes | Pasan a Cancelada; la selección se limpia |
| AL-29 | Reintentar | Seleccionar Fallida/Cancelada | Vuelve a Pendiente (intentos 0) y se despacha; toast con enviadas/fallidas |
| AL-30 | Vista previa | Seleccionar una sola | Iframe con el HTML; con 0 o 2+ filas, mensaje de ayuda |
| AL-31 | HTML hostil | Alerta con `<script>` en `cuerpo_html` (insertada por SQL) | No se ejecuta (sandbox); no navega ni abre ventanas |
| AL-32 | Historial | Revisar | 300 filas máx., estados con color, destinatarios y detalle |
| AL-33 | Selección múltiple con teclado | Navegar solo con teclado | Documentar la falta de acceso por teclado en filas (H-14) |
| AL-34 | Cola grande | 1 000 pendientes | Muestra 200; documentar que no hay paginación |
| AL-35 | Mensajes en simulación | Con `dry_run` activo, «Reintentar» | El resultado debe indicar que fue simulado (H-21) |
| AL-36 | Concurrencia | Cancelar una alerta que otro proceso ya envió | No debe reabrirla; el `update` solo afecta `Pendiente` |

## Puntos sospechosos
- `Alertas.jsx:33`, `FormularioSmtp.jsx:44-46`, `ActivacionEnvio.jsx:42,48`, `ColaEnvios.jsx:44,49`, `TarjetaRegla.jsx:20,65`: sin manejo de errores (H-05).
- `TarjetaRegla.jsx:25`: hora inválida reemplazada en silencio; `NumberField` sin mínimo (H-13).
- `api/alertas.js:34-40` (`reintentarAlertas`) acepta cualquier id y reinicia `intentos`; cualquier estado se puede «reintentar» por API (reenvío de enviadas).
- `correo/index.ts:24-41` (`guardar`) permite cambiar `host` sin reingresar la contraseña: combinado con H-01, exfiltración de la contraseña.
- `ActivacionEnvio.jsx:38`: la «prueba exitosa» vive solo en el estado local.
- `supabase/migrations/...004_semillas.sql:3-4`: correo real del PO y `app_url` con `localhost` (H-15).

## Evidencia a capturar
Capturas de cada estado, respuesta de `correo/*` (sin contraseña), filas de `smtp_config` (solo en el SQL Editor), buzón sandbox con el correo recibido (cabeceras From/To/Subject y HTML), filas de `auditoria`.

## Severidad y prioridad
Contraseña expuesta o activación de envío real sin controles = S1. Alerta que no cambia de estado correctamente = S2. Falta de feedback = S3.

## Formato de salida
| ID | Escenario | Resultado | Evidencia | Bug (ID, S/P) |
Después: bugs con la plantilla `98` y tres recomendaciones.
