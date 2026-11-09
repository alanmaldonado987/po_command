# 19 · Resiliencia, errores de red y recuperación

> Copia todo este archivo como prompt. Prefijo de casos: **RS**. Herramientas: DevTools (Offline, Throttling, «Block request URL», «Local overrides»), un proxy como mitmproxy/Fiddler, el panel de Supabase (pausar proyecto, logs) y el SQL Editor.

## Rol y mentalidad
Ingeniero de fiabilidad/QA: asumes que **todo falla**: la red, el servidor, el proveedor SMTP, el navegador, el usuario que cierra la pestaña. Cada fallo debe ser **visible, entendible y recuperable**, y no debe dejar datos a medias ni correos duplicados.

## Contexto técnico
- Cliente de datos: `web/src/lib/supabase.js` (`consultar` lanza `Error(error.message)`; `invocarFuncion` extrae `error` del cuerpo de la función). React Query: `retry: 1`, `staleTime` 15 s (`main.jsx`), mutaciones sin `onError` global (`hooks/useMutacion.js`).
- Patrón de dos pasos «RPC y luego función»: `FormularioItem.jsx:35-42`, `BloqueantesActivos.jsx:56-61` (la RPC `guardar_item` confirma y después se llama a `alertas/item_guardado`; el fallo del segundo paso solo se avisa en el formulario).
- Mutaciones sin `try/catch` (H-05): `FormularioCeremonia.jsx:46`, `DetalleCeremonia.jsx:46,51`, `EditorAcuerdos.jsx:72-75`, `EditorPersona.jsx:66,77`, `TarjetaRegla.jsx:20,65`, `FormularioSmtp.jsx:44-46`, `ActivacionEnvio.jsx:42,48`, `ColaEnvios.jsx:44,49`, `pages/Alertas.jsx:33`, `features/centro/AvisoInicio.jsx:15`. Las que sí tratan errores: `BloqueantesActivos.jsx`, `PanelAcciones.jsx`, `FormularioItem.jsx`, `TarjetaPo.jsx`, `PestanaCatalogos.jsx`, `BotonRespaldo.jsx`.
- Estados de página: `LoadingState`/`ErrorState` (`components/ui/LoadingState.jsx`); algunas páginas no muestran error si falla una consulta secundaria.
- Cola de alertas: 3 intentos, +10 min por intento (`_shared/cola.ts`), `reservar` empuja `enviar_en` antes de enviar.
- Importación atómica (`importar_plan`); `eliminar_item`/`eliminar_ceremonia` cancelan alertas.
- Sesión: `supabase-js` renueva el token; sin recuperación de contraseña en la UI.

## Archivos a leer
`lib/supabase.js`, `hooks/useMutacion.js`, `main.jsx`, `components/ui/LoadingState.jsx`, las pantallas listadas arriba, `supabase/functions/_shared/{cola,respuesta}.ts`.

## Datos de prueba
Plan importado; SMTP sandbox; capacidad de pausar/reanudar el proyecto de pruebas; pestañas de dos navegadores.

## Escenarios
| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| RS-01 | Sin red al abrir | Offline y recargar | Pantalla de error comprensible (no blanca); al volver la red, se recupera sin recargar manualmente o con botón «Reintentar» |
| RS-02 | Red cae al guardar un ítem | Offline justo al pulsar «Guardar» | Mensaje de error en el formulario; los datos escritos siguen allí; reintentar guarda una sola vez |
| RS-03 | Red cae entre la RPC y el aviso | Bloquear solo `functions/v1/alertas` | Ítem guardado; mensaje «No se pudo avisar…»; documentar que no hay reintento (H-06) |
| RS-04 | Resolver/Escalar sin red | En el Centro de Mando | Toast de error; el bloqueo no cambia de estado visualmente |
| RS-05 | Mutaciones sin manejo de errores | Bloquear la petición en cada pantalla de la lista H-05 | **Esperado:** mensaje de error. Documentar cada pantalla donde no aparece nada (promesa rechazada en consola) |
| RS-06 | Respuesta 500 de PostgREST | Sobrescribir la respuesta (Local overrides) con 500 | `ErrorState` o toast; sin bucles de reintento agresivos |
| RS-07 | Respuesta 401 en medio de la sesión | Invalidar el token (Authentication → cerrar sesiones) | Redirige al login; sin pantalla rota ni peticiones infinitas |
| RS-08 | Token caducado y refresco fallido | Bloquear `auth/v1/token` | Mensaje claro o redirección |
| RS-09 | Proyecto pausado | Pausar el proyecto de pruebas | Mensaje de error en todas las pantallas; al reanudar, la app se recupera |
| RS-10 | Latencia alta | «Slow 3G» | Indicadores de carga; botones deshabilitados durante el envío; sin doble guardado |
| RS-11 | Doble envío | Doble clic en Guardar/Escalar/Invitar/Importar | Una sola operación (botones con `loading`); si existe duplicado, documentar |
| RS-12 | Cerrar pestaña a mitad | Cerrar durante guardar ítem, importar, enviar invitación | Estado consistente al volver (ver RS-13…15); sin duplicados |
| RS-13 | Importación interrumpida | Cortar la red durante `importar_plan` | Todo o nada: base sin cambios; mensaje de error; reimportar funciona |
| RS-14 | Guardado de acuerdos parcial | Provocar fallo en una fila de varias | Estado visible y coherente; sin duplicados al reintentar (H-05) |
| RS-15 | Evento perdido | Guardar un bloqueo y cerrar la pestaña antes de `item_guardado` | Documentar la alerta ausente y proponer outbox (H-06) |
| RS-16 | Función `alertas` caída | Detener o romper el despliegue | Mensaje claro en acciones que la usan; el resto de la app sigue operativa |
| RS-17 | Función con timeout | Retrasar SMTP artificialmente | La UI no se queda cargando indefinidamente; mensaje de tiempo agotado |
| RS-18 | SMTP caído | `dry_run=false` y host inaccesible | Cola: reintentos 1–3, estado `Fallida`, error visible en la cola y en el historial; KPI «Fallidas» sube |
| RS-19 | SMTP intermitente | Fallar 2 veces y recuperar | Se envía en el 3.er intento una sola vez (sin duplicados) |
| RS-20 | Recuperación manual | Reintentar `Fallida` y `Cancelada` | Vuelve a la cola, se envía; no se duplica si ya salió |
| RS-21 | Función interrumpida a mitad de `despachar` | Matar durante una tanda | Alertas reservadas se reintentan tras 10 min; verificar que no queden «huérfanas» ni reenvíos inesperados (H-11) |
| RS-22 | Cron detenido | Pausar el job 24–48 h y reactivar | Retoma sin inundar; vencimientos y ceremonias consistentes |
| RS-23 | Cron con error de autenticación | Cambiar `service_role_key` en Vault | Fallo visible en `net._http_response`/`cron.job_run_details`; documentar cómo se detecta |
| RS-24 | Base de datos restaurada | Restaurar un respaldo anterior | La app abre; las claves únicas de alertas no impiden alertas nuevas; auditoría coherente |
| RS-25 | Migración fallida | Aplicar la 003 en una base con datos | Rollback limpio; documentar procedimiento |
| RS-26 | Recarga durante edición | Escribir en el formulario y recargar | Documentar pérdida de borrador (no hay autoguardado) |
| RS-27 | Dos pestañas | Editar en A y B, guardar ambas | Aviso o resultado documentado (H-12) |
| RS-28 | Atrás/adelante | Usar el historial del navegador en medio de un flujo | No reabre editores obsoletos con datos viejos |
| RS-29 | Sesión larga | 8 h con la pestaña dormida | Al volver, datos refrescados y sesión válida o login claro |
| RS-30 | Almacenamiento bloqueado | Navegación privada/cookies bloqueadas | Mensaje claro; sin bucles de login |
| RS-31 | Reloj del cliente desfasado | Adelantar/atrasar el reloj 2 h | Sesión y «hoy» razonables; documentar efectos |
| RS-32 | Excel corrupto | Subir archivo dañado | Error entendible; sin bloqueo de la pantalla (CF-31) |
| RS-33 | Errores de la IA | Modelo caído/lento | Texto local + aviso; el chat sigue operando |
| RS-34 | Conflicto de borrado | Eliminar en A un ítem abierto en B y guardar en B | Mensaje «El ítem n no existe» visible en B |
| RS-35 | Mensajes de error | Revisar todos los textos | Sin SQL ni trazas; con acción sugerida |

## Puntos sospechosos
- Patrón de dos pasos sin outbox (`FormularioItem.jsx:35-42`, `BloqueantesActivos.jsx:56-61`; H-06).
- Lista de mutaciones sin `try/catch` (H-05); `hooks/useMutacion.js` no define `onError`.
- `_shared/cola.ts:98-117` y `:62-73`: reserva y reenvío (H-11).
- `_shared/respuesta.ts:19-20`: los errores 500 exponen el mensaje interno; la UI los muestra tal cual.
- `main.jsx:9`: `retry: 1` puede ocultar errores intermitentes; no hay indicador global de «sin conexión».
- `ActivacionEnvio.jsx:38`: el estado «prueba exitosa» se pierde al recargar.

## Evidencia a capturar
Vídeo de cada fallo inyectado, pestaña Network con la petición bloqueada/modificada, consola (rechazos sin tratar), consulta SQL del estado resultante, logs de la función y del cron.

## Severidad y prioridad
Estado a medias o dato perdido tras un fallo = S1/S2. Falla sin ningún mensaje = S3 (P1 si afecta alertas o importación). Mensaje técnico poco claro = S4.

## Formato de salida
| ID | Escenario | Fallo inyectado | Comportamiento observado | Evidencia | Bug (ID, S/P) |
Al final: lista de operaciones clasificadas en seguras / parcialmente seguras / inseguras ante fallos.
