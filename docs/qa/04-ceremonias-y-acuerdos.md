# 04 · Prueba funcional: Demos & Ceremonias y Acuerdos (`/ceremonias`)

> Copia todo este archivo como prompt. Prefijo de casos: **CE**.

## Rol y mentalidad
QA senior que desconfía de las fechas con hora y de los formularios editables por filas: busca duplicados, pérdidas de filas y mensajes que prometen más de lo que ocurre.

## Contexto técnico
- Página `web/src/pages/Ceremonias.jsx`: `AgendaCeremonias` (toggle «Ver pasadas», «Agendar»), `DetalleCeremonia`, `FormularioCeremonia`, `EditorAcuerdos`.
- Tablas/vistas: `ceremonia` (`fecha_hora timestamptz`, `duracion_min > 0`, `audiencia` ∈ equipo/stakeholders/todos, `invitacion_enviada`), vista `v_ceremonia` (con `cliente`), `acuerdo` (estado Pendiente/En curso/Cumplido, `fecha_limite`), vista `v_acuerdo`.
- Invitación: Edge Function `alertas` acción `invitar_ceremonia {ceremonia_id}` → `{destinatarios}`; marca `invitacion_enviada = true`; la clave única incluye `Date.now()` (cada reenvío genera un correo). Destinatarios: `audiencia` + PO según `audiencia`, solo quienes reciben la categoría «Ceremonias» y tienen correo válido (si no, se redirige al PO).
- Eliminar: RPC `eliminar_ceremonia` (cancela alertas `entidad='ceremonia'` y borra; devuelve nº canceladas). `acuerdo.ceremonia_id` pasa a `null`.
- Recordatorios automáticos: reglas `CEREMONIA` (N horas antes, por defecto 24, y 1 h antes) y `ACUERDO_VENCIDO` (ver prompt 13).
- Fecha/hora del formulario: `lib/fechas.js` (`desdeInputDateTime` usa la zona del navegador).

## Archivos a leer
`pages/Ceremonias.jsx`, `features/ceremonias/*`, `hooks/useCeremonias.js`, `api/ceremonias.js`, `supabase/functions/alertas/index.ts:66-95`, `_shared/reglas.ts` (`revisarCeremonias`, `revisarAcuerdos`).

## Datos de prueba
Ceremonias: una pasada, una de hoy, una en 3 horas, una en 2 días, una `Demo` de un cliente con ítems `Terminado, en etapa de pruebas` (25 ítems para probar el tope de 20). Personas: equipo con y sin correo, stakeholder del cliente. Acuerdos: uno vencido, uno cumplido, uno sin fecha, uno sin responsable.

## Escenarios
| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| CE-01 | Agenda por defecto | Abrir | Solo ceremonias con fecha ≥ hoy, orden cronológico |
| CE-02 | «Ver pasadas» | Activar | Se incluyen las pasadas |
| CE-03 | Tarjeta de fecha | Revisar | Mes (3 letras en mayúscula) y día coloreados por tipo; hora y duración; invitados; cliente; chip «Invitación enviada»/«Sin enviar» |
| CE-04 | Seleccionar | Elegir una | Panel de detalle + formulario de edición; tarjeta marcada |
| CE-05 | Sin selección | Inicial | Mensaje «Elige una ceremonia…» |
| CE-06 | Destinatarios | Revisar «Recibirán la invitación (n)» | Coincide con el resolver para `audiencia` (equipo / stakeholders / todos) + PO; nombres con «(en lugar de …)» si falta correo |
| CE-07 | Nadie con correo | Vaciar correos y PO | «nadie con correo válido» |
| CE-08 | Enviar invitación | Pulsar | `alerta_programada` con asunto `[Invitación] …`; `invitacion_enviada = true`; el botón pasa a «Reenviar invitación» (secundario) |
| CE-09 | Reenviar | Pulsar de nuevo | Nuevo correo en cola (no se bloquea por clave única) |
| CE-10 | Mensaje en simulación | Con `dry_run` activo | El toast no debe afirmar que se envió un correo real (H-21) |
| CE-11 | Eliminar ceremonia | Pulsar «Eliminar ceremonia» | Desaparece; alertas pendientes `Cancelada`; sin confirmación previa (documentar); acuerdos asociados quedan con `ceremonia_id null` |
| CE-12 | Ítems para demo | Ceremonia `Demo` con cliente | Lista de ítems `Terminado, en etapa de pruebas` del cliente, máx. 20 + «Y N más» |
| CE-13 | Demo sin cliente / otro tipo | Revisar | No muestra la lista |
| CE-14 | Fallo al eliminar/invitar | Cortar red | Mensaje de error visible (hoy falta, H-05) |
| CE-15 | Crear ceremonia | Completar todo | Se crea; toast «Ceremonia guardada. Los recordatorios se programan automáticamente.»; queda seleccionada |
| CE-16 | Título vacío | Guardar | «El título es obligatorio.» |
| CE-17 | Duración | 0, 4, 481, vacío, decimal | Respeta mín. 5 / máx. 480 en el input; vacío → 60; el servidor rechaza ≤ 0 |
| CE-18 | Fecha y hora | Crear 23:30 y editar | Se conserva la hora local; verificar `fecha_hora` en UTC y que el correo muestre la hora de Bogotá (H-09) |
| CE-19 | Editar | Cambiar título/fecha | Se actualiza; **comprobar** si los recordatorios ya encolados quedan con la fecha vieja |
| CE-20 | Cliente «Todos / general» | Dejar vacío | `cliente_id null`; tarjeta sin cliente |
| CE-21 | Acuerdos: alta | «Agregar acuerdo» + descripción + «Guardar acuerdos» | Fila en `acuerdo`; toast «Acuerdos guardados.» |
| CE-22 | Acuerdos: edición | Cambiar estado/fecha/responsable | Persisten tras recargar |
| CE-23 | Acuerdos: quitar | Quitar fila existente y guardar | Se borra en la base |
| CE-24 | Fila sin descripción | Guardar con una fila vacía | La fila vacía se ignora |
| CE-25 | Doble clic en guardar | Pulsar rápido dos veces con filas nuevas | No debe crear duplicados (revisar `EditorAcuerdos.jsx:58-78` y la clave de `Ceremonias.jsx:61`) |
| CE-26 | Fallo parcial | Provocar error en una de varias filas (p. ej. responsable inexistente) | Estado coherente y mensaje; hoy `Promise.all` puede dejar mezcla (H-05) |
| CE-27 | Pérdida de ediciones | Editar una fila y esperar a que otra pestaña modifique acuerdos | No deben perderse cambios sin guardar por el remontado del editor |
| CE-28 | Acuerdo vencido | `fecha_limite` ayer, estado Pendiente | Genera `ACUERDO_VENCIDO` en el siguiente `tick` (una sola vez por acuerdo) |
| CE-29 | Cumplido | Marcar Cumplido | No genera aviso |

## Puntos sospechosos
- `EditorAcuerdos.jsx:58-78`: estado local inicializado una vez; las filas nuevas conservan `id: null` hasta el refetch; `Promise.all` sin `try/catch` (H-05). `pages/Ceremonias.jsx:61` remonta el editor por cambio de ids.
- `FormularioCeremonia.jsx:46`, `DetalleCeremonia.jsx:46,51`: sin manejo de errores (H-05).
- `DetalleCeremonia.jsx:47`: mensaje de éxito también en simulación (H-21).
- `alertas/index.ts:90`: `Date.now()` en la clave permite reenvíos masivos con doble clic.
- Editar la fecha de una ceremonia no reprograma los recordatorios ya en cola (claves incluyen `fecha_hora`, así que se crearían nuevos en el siguiente `tick`; confirmar que los viejos no se envían).

## Evidencia a capturar
Capturas, respuesta de `invitar_ceremonia`, filas de `alerta_programada` (asunto, destinatarios, `clave_unica`, `enviar_en`), `ceremonia.fecha_hora` en UTC, `acuerdo` antes/después.

## Severidad y prioridad
Duplicados o pérdida de acuerdos = S2/P1. Invitación a destinatarios equivocados = S1. Falta de feedback ante error = S3/P2.

## Formato de salida
| ID | Escenario | Resultado | Evidencia | Bug (ID, S/P) |
Después: bugs con la plantilla `98` y tres recomendaciones.
