# Backend de PO Command Center (Supabase)

## Contenido

- `migrations/`: esquema, vistas, funciones de negocio (RPC) y datos iniciales.
- `functions/alertas`: motor de alertas (reglas, cola, envío, eventos del backlog).
- `functions/correo`: configuración y prueba del SMTP.
- `functions/ia`: redacción opcional con un modelo compatible con OpenAI.
- `cron.sql`: programador que ejecuta las alertas cada 15 minutos.

## Puesta en marcha

1. Enlaza el proyecto y aplica las migraciones:

   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```

2. Crea el usuario del Product Owner en **Authentication → Users → Add user** (correo y contraseña, con
   *Auto confirm user*). En **Authentication → Providers → Email** desactiva **Allow new users to sign up**
   para que nadie más pueda registrarse.

3. Despliega las funciones:

   ```bash
   supabase functions deploy alertas correo ia
   ```

4. Secretos opcionales para la redacción con modelo (sin ellos, la app usa solo el asistente local):

   ```bash
   supabase secrets set IA_BASE_URL=https://api.openai.com/v1 IA_MODEL=gpt-4o-mini IA_API_KEY=<clave>
   ```

   El SMTP no usa secretos: se configura desde la app en **Alertas & Notificaciones → Envío de correos** y queda
   en la tabla `smtp_config`, que solo puede leer el service role.

5. Programa las alertas. En el SQL Editor guarda los secretos en Vault y ejecuta `cron.sql`:

   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<service_role_key>', 'service_role_key');
   ```

6. Frontend: copia `web/.env.example` a `web/.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, y
   actualiza `config.app_url` (tabla `config`) con la URL pública de la app para el botón de los correos.

## Pruebas de las funciones

Las pruebas están en `functions/_tests/` y usan un cliente de Supabase en memoria y un SMTP simulado, así que no necesitan red ni credenciales. Requieren [Deno](https://deno.com):

```bash
cd supabase/functions
deno test --allow-env _tests/
deno check alertas/index.ts correo/index.ts ia/index.ts clickup/index.ts clickup-webhook/index.ts
```

El prefijo `_` evita que la CLI intente desplegar esa carpeta como una función.

## Contrato de las funciones

Todas reciben `POST` con JSON `{ "accion": ... }` y responden JSON; los errores salen como `{ "error": mensaje }`.

| Función | Acción | Respuesta |
|---|---|---|
| `alertas` | `tick` | `{ creadas, enviadas, fallidas }` |
| | `despachar` | `{ enviadas, fallidas }` |
| | `item_guardado` `{ resultado }` | `{ mensaje }` |
| | `escalar` `{ bloqueante_id }` | `{ ok, mensaje }` |
| | `resumen` | `{ destinatarios, mensaje }` |
| | `recordar` `{ item_ids }` | `{ correos, mensaje }` |
| | `invitar_ceremonia` `{ ceremonia_id }` | `{ destinatarios }` |
| | `destinatarios` `{ roles?, categoria?, regla_codigo?, item_id?, cliente_id?, audiencia? }` | `[{ nombre, correo, rol }]` |
| `correo` | `estado` | configuración sin contraseña + `password_guardada`, `configurado` |
| | `guardar` `{ valores }` | igual que `estado` |
| | `probar` | `{ ok, detalle, explicacion? }` |
| | `prueba` `{ destino }` | `{ ok, detalle, explicacion? }` |
| | `modo` `{ dry_run }` | igual que `estado` |
| `ia` | `estado` | `{ disponible, modelo }` |
| | `redactar` `{ pregunta, borrador, historial }` | `{ texto }` |

El correo arranca en modo simulación (`smtp_config.dry_run = true`): las alertas se registran en
`notificacion_log` pero no sale ningún mensaje hasta activar el envío real desde la app.

## Integración con ClickUp (bidireccional)

Crear, editar y eliminar ítems se refleja en ClickUp, y los cambios hechos en ClickUp vuelven a la app.

### Activación

1. Aplica la migración nueva y despliega las dos funciones nuevas:

   ```bash
   npx supabase db push --linked
   npx supabase functions deploy clickup
   npx supabase functions deploy clickup-webhook --no-verify-jwt
   ```

   La migración `20261106000007_clickup_tableros.sql` añade los tableros; si ya tenías la integración desplegada, aplícala y vuelve a desplegar `clickup` y `clickup-webhook`.
   La migración `20261106000009_mapeo_estados_multiple.sql` permite varios nombres de ClickUp por estado de la app, compara los nombres sin emojis ni tildes, trata el tipo `done` como Terminado y añade la reconciliación forzada. Tras `db push`, vuelve a desplegar `clickup` (el webhook no cambia) y sigue [Mapeo de estados](#mapeo-de-estados).
   La migración `20261106000008_prioridad.sql` añade la prioridad de los ítems. Tras desplegarla, **quita el webhook y vuelve a registrarlo** desde la app para suscribirlo también al evento `taskPriorityUpdated`; el webhook ya registrado conserva los eventos con los que se creó.

2. Ejecuta de nuevo `cron.sql` en el SQL Editor (añade los jobs `po-clickup-sincronizar`, cada minuto, y `po-clickup-reconciliar`, cada 10 minutos).
3. En la app (pantalla de integración): pega tu token personal de ClickUp (ClickUp → Configuración → Apps → API Token), pulsa **Probar**, elige el equipo y guarda.
4. Configura los destinos en `clickup_destino` (ver [Tableros](#tableros-desarrollo-analítica)): como mínimo una lista por defecto (`tablero_id` y `cliente_id` nulos) y, si quieres, listas por cliente y por tablero. Sin destino, el envío queda en `Fallida` con el mensaje «Sin destino configurado para {tablero} / {cliente}».
5. Revisa el mapeo de estados (ver [Mapeo de estados](#mapeo-de-estados); por defecto: No iniciado → `pendiente`, En curso → `en desarrollo`, Terminado, en etapa de pruebas → `validación`, Terminado → `entregado`, Suspendido → `suspendido`). Al enviar, el nombre debe existir en los estados de la lista de ClickUp; si no existe, la tarea se crea con el estado inicial de la lista.
6. Habilita la integración y pulsa **Registrar webhook**. Si tu plan de ClickUp no lo permite, el sistema sigue funcionando: ClickUp → app se sincroniza por la revisión periódica.
7. Para enviar a ClickUp los ítems que ya existían, usa la acción `encolar_sin_vincular`; para traer las tareas que ya están en una lista, `importar_existentes`.

### Mapeo de estados

`clickup_config.mapeo_estados` (y, opcionalmente, `clickup_tablero.mapeo_estados`) es un objeto `{ estadoDeLaApp: nombres }` donde `nombres` es un texto **o una lista de textos**:

```json
{
  "No iniciado": ["Pendiente"],
  "En curso": ["En desarrollo"],
  "Terminado, en etapa de pruebas": ["Validación", "Listo para entregar"],
  "Terminado": ["Entregado"]
}
```

- **Al enviar a ClickUp** (app → ClickUp) se usa el **primer** nombre no vacío de la lista; escríbelo tal como se llama el estado en la lista de ClickUp. Un estado de la app sin mapeo (p. ej. «Suspendido») no envía estado, y si ClickUp rechaza el nombre la tarea se guarda igual sin él.
- **Al leer de ClickUp** (ClickUp → app) se aceptan **todos** los nombres de la lista. La comparación solo mira letras y dígitos: ignora emojis, símbolos, tildes, mayúsculas y espacios, así que `☑ ENTREGADO`, `Entregado` y `entregado` son el mismo estado. Si un nombre aparece en varios estados, gana el primero en el orden del flujo (No iniciado, En curso, Terminado en etapa de pruebas, Terminado, Suspendido).
- **Respaldo por tipo:** si ningún nombre coincide y el estado de ClickUp es de tipo `closed` o `done`, el ítem queda `Terminado`. Si no, queda `No iniciado` al crearlo y conserva su estado al actualizarlo.
- El texto suelto de antes (`"En curso": "en desarrollo"`) sigue siendo válido. La base rechaza valores que no sean texto o lista de textos (`clickup_config_mapeo_estados_ck`, `clickup_tablero_mapeo_estados_ck`).
- El mapeo por tablero reemplaza, estado por estado, al global.

**Aplicar un mapeo nuevo a los ítems ya importados.** La reconciliación normal ignora las tareas que no han cambiado desde la última sincronización (no pisa ediciones de la app), así que cambiar el mapeo no actualiza lo que ya entró. Para hacerlo una vez, ejecuta la acción `reconciliar` con `forzar: true`: omite solo los chequeos de «gana el cambio más reciente» y aplica los datos de ClickUp sobre el ítem. Sigue respetando los ítems eliminados en la app, los que tienen un envío pendiente y el archivado, y no encola un envío de vuelta. **Sobrescribe los cambios hechos a mano en la app desde la importación** en los campos que ClickUp aporta (nombre, estado, fechas, responsable, alcance, fase, prioridad, bloqueo).

### Tableros (Desarrollo, Analítica…)

Un tablero agrupa a las personas que trabajan en el mismo tablero de ClickUp. Cada persona del equipo pertenece como máximo a uno (`persona.tablero_id`) y **el tablero de un ítem lo decide su responsable**. Un ítem vive en un solo tablero; si no tiene responsable, o el responsable no tiene tablero, se enruta como «sin tablero».

**Orden de resolución del destino** (la misma lógica en SQL, `destino_clickup`, y en TypeScript, `resolverDestino`; la primera coincidencia gana):

1. tablero del responsable **y** cliente del ítem;
2. tablero del responsable, sin cliente;
3. sin tablero, cliente del ítem;
4. sin tablero ni cliente: el destino por defecto global.

Sin ninguna coincidencia: un `create` no se encola y queda registrado como `Fallida` con el motivo en `clickup_cola` (el ítem se guarda igual). Un ítem ya vinculado sigue enviando sus actualizaciones; solo se omite el movimiento.

**Mapeo de estados por tablero.** `clickup_tablero.mapeo_estados` (opcional) sobrescribe, estado por estado, el mapeo global de `clickup_config`; lo que el tablero no define cae al global. Se usa al construir la tarea y al leerla.

**Cómo se mueve una tarea.** Se encola la acción `mover` cuando:

- cambia el responsable o el cliente de un ítem vinculado y su nuevo destino es otra lista;
- cambia el tablero de una persona (se evalúan sus ítems abiertos y vinculados);
- ClickUp cambia el asignado y el nuevo responsable corresponde a otro destino (excepción a la supresión de eco: la app responde moviendo la tarea).

Solo se mueven las tareas que **viven en una lista con destino configurado**: si alguien movió a mano una tarea a una lista ajena al plan (por ejemplo un sprint), la app no la devuelve.

El movimiento usa el endpoint nativo de la API v3 `PUT /api/v3/workspaces/{equipo}/tasks/{tarea}/home_list/{lista}` (cambia la lista de origen sin perder el identificador, los comentarios ni el historial). Si el estado actual no existe en la lista destino, se envía `status_mappings` con el estado del mapeo efectivo del nuevo tablero (o el primer estado abierto de la lista). Después se actualiza la tarea con los datos del tablero nuevo.

**Alternativa documentada.** Si ClickUp responde 403, 404, 405 o 501 al movimiento (endpoint no disponible en el plan o la cuenta), o no hay equipo configurado, se crea una tarea nueva en la lista destino con el contenido actual, se copia el vínculo (`clickup_task_id`) y se archiva la anterior con un comentario que apunta a la nueva. En ese caso se pierden los comentarios y subtareas de la tarea original, y si fallan el comentario o el archivado, la tarea anterior queda abierta como duplicado (la nueva ya está vinculada).

La configuración de destinos vive en `clickup_destino (tablero_id, cliente_id, lista_id, lista_nombre)` con unicidad por pareja (los `NULL` cuentan como iguales). Borrar un tablero libera a sus personas y borra sus destinos.

### Cómo se representa un ítem en ClickUp

Solo campos nativos (sin campos personalizados, por los límites del plan gratuito):

| App | ClickUp |
|---|---|
| Título (`Módulo · completo` si la funcionalidad es «Completo») | Nombre |
| Estado | Estado (según `mapeo_estados`) |
| Responsable | Asignado (por correo, entre los miembros del equipo) |
| Prioridad (`Urgente`, `Alta`, `Normal`, `Baja` o sin prioridad) | Prioridad nativa: 1, 2, 3 y 4 (`urgent`, `high`, `normal`, `low`); sin prioridad es `null` |
| Inicio planificado / fecha comprometida (fin de pruebas o fin de desarrollo) | Fecha de inicio / fecha límite (a mediodía de Bogotá, sin hora) |
| Alcance, fase, «bloqueado» | Etiquetas |
| Descripción, cliente, actividad, módulo, fechas ejecutadas y demás | Descripción en markdown, con un bloque `<!--po-command {…} -->` al final |

**Prioridad.** `item.prioridad` es texto o `NULL`; `guardar_item` acepta `datos.prioridad` (vacío equivale a `NULL`, un valor fuera de la lista falla con «La prioridad debe ser Urgente, Alta, Normal o Baja») y `v_item` la expone. Un cambio de prioridad en la app encola un `update`. Al actualizar, la función solo envía `priority` cuando difiere de la de la tarea en ClickUp (y `priority: null` si se quitó). En sentido inverso, `aplicar_cambio_clickup` lee `priority` de la tarea (`priority.priority` o `priority.id`): un valor conocido la actualiza, `priority: null` la quita, un valor desconocido o la ausencia del campo no cambian nada; rige el mismo criterio de «gana el más reciente».

El bloque estructurado solo se lee al crear en la app una tarea que nació en ClickUp con ese bloque; en ítems existentes la app conserva sus propios datos.

### Modelo de conflictos y borrados

- **Gana el cambio más reciente.** Un cambio de ClickUp se aplica solo si su `date_updated` es posterior a la última edición del ítem en la app (`actualizado_en`) y a la última sincronización (`clickup_sync_en`). El eco de nuestras propias escrituras se ignora por esa misma comparación.
- Si el ítem tiene un envío pendiente en la cola, el cambio entrante se ignora y el envío posterior lo sobrescribe: una edición hecha en ClickUp durante esos segundos se pierde.
- **Eliminar archiva.** Eliminar un ítem archiva la tarea en ClickUp; archivar o borrar la tarea elimina lógicamente el ítem (recuperable desde la base).
- Los cambios que llegan de ClickUp no generan envíos de vuelta (la sesión marca `po.origen = clickup`).

### Limitaciones

- El movimiento entre listas depende de la API v3 de ClickUp, que no se pudo probar con una cuenta real (ver supuestos).
- ClickUp limita a unas 100 peticiones por minuto por token; la cola se procesa por lotes de 30 y espera ante un 429. Una importación grande puede tardar varios minutos.
- Si una tarea tiene varios asignados, la app conserva solo al responsable y quita los demás.
- Las fechas de ClickUp sin hora se interpretan en la zona de Bogotá.
- La app trata como tareas del plan solo las de listas con destino configurado; las subtareas no se listan.

### Supuestos de la API de ClickUp sin verificar contra una cuenta real

La documentación se consultó solo mediante búsquedas; ningún endpoint se probó con credenciales reales.

- Los webhooks por API (`POST /team/{id}/webhook`) podrían no estar disponibles en el plan gratuito; la ayuda de ClickUp indica que las automatizaciones con webhook sí requieren un plan de pago.
- Los eventos `taskCreated`, `taskUpdated` y `taskDeleted` están confirmados en la documentación; `taskPriorityUpdated` (que ClickUp envía junto con un `taskUpdated`) figura como evento propio en la documentación; `taskStatusUpdated`, `taskAssigneeUpdated`, `taskDueDateUpdated`, `taskTagUpdated` y `taskMoved` se incluyen por referencia y ClickUp podría rechazar alguno.
- Se envía la descripción en `description` y `markdown_content` a la vez (el segundo prevalece); ClickUp podría no conservar los comentarios HTML del bloque estructurado.
- `GET /space/{id}/folder` y `/space/{id}/list` podrían no incluir los estados de cada lista; en ese caso se consultan con `GET /list/{id}`.
- Un estado inexistente en la lista devuelve 400; la función reintenta una vez sin estado.
- El movimiento nativo (`PUT /api/v3/workspaces/{id}/tasks/{id}/home_list/{id}`) y el cuerpo `{ move_custom_fields, status_mappings: [{ source_status, destination_status }] }` provienen de la documentación pública («Move a task to a new List»), de una página de preguntas frecuentes que aún dice que no es posible y de integraciones de terceros; no se probaron con credenciales. Los identificadores de estado salen de `status.id` de la tarea y de `statuses[].id` de la lista.
- La prioridad se envía como número (1 urgente, 2 alta, 3 normal, 4 baja), tal como indica la documentación; que `priority: null` en `PUT /task/{id}` borre la prioridad no está confirmado en la documentación pública.
- Se asume que `GET /task/{id}` y `GET /list/{id}` devuelven el `id` de cada estado.
- La respuesta del movimiento no se usa: después se vuelve a leer la tarea.
- Archivar una tarea con `PUT /task/{id}` y `{ archived: true }` y comentar con `POST /task/{id}/comment` (`comment_text`) siguen la API v2.
- La firma del webhook es `X-Signature` = HMAC-SHA256 en hexadecimal del cuerpo crudo con el secreto devuelto al crear el webhook.

### Contrato de la función `clickup`

| Acción | Respuesta |
|---|---|
| `estado` | `{ habilitado, token_configurado, conectado, equipo, webhook_registrado, pendientes, con_error, ultimo_sync, mapeo_estados, tableros: [{ id, nombre, mapeo_estados \| null, destinos }], sin_destino }` |
| `guardar_config` `{ token?, habilitado?, equipo_id?, equipo_nombre?, mapeo_estados? }` | igual que `estado` (`mapeo_estados`: `{ estadoApp: string \| string[] }`; las listas se limpian de textos vacíos) |
| `probar` | `{ ok, usuario, equipos: [{ id, nombre }] }` o `{ ok: false, detalle, explicacion? }` |
| `jerarquia` `{ equipo_id }` | `{ espacios: [{ id, nombre, carpetas: [{ id, nombre, listas }], listas }] }`, con `listas: [{ id, nombre, estados }]` |
| `registrar_webhook` / `quitar_webhook` | `{ webhook_id }` / igual que `estado` |
| `sincronizar` | `{ procesadas, errores }` (procesa `create`, `update`, `archive` y `mover`) |
| `reconciliar` `{ tablero_id?, forzar? }` | `{ creadas, actualizadas, archivadas }` (con `tablero_id` solo recorre las listas de ese tablero; con `forzar: true` aplica el estado de ClickUp también a ítems con la sincronización al día, ver [Mapeo de estados](#mapeo-de-estados)) |
| `importar_existentes` `{ lista_id, cliente_id?, tablero_id? }` | `{ importadas }` (el cliente se infiere del destino de la lista; `tablero_id` elige el destino cuando la lista tiene varios) |
| `encolar_sin_vincular` | `{ encolados }` |

`clickup-webhook` recibe los eventos de ClickUp (sin JWT), valida `X-Signature` y responde 200 también cuando el procesamiento falla, para que ClickUp no desactive el webhook; la reconciliación recupera lo perdido.
