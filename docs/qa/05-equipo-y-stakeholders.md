# 05 · Prueba funcional: Equipo & Stakeholders (`/equipo`)

> Copia todo este archivo como prompt. Prefijo de casos: **EQ**.

## Rol y mentalidad
QA senior que entiende que este directorio **alimenta al motor de alertas**: un error aquí significa correos a la persona equivocada o ausencia de avisos. Verificas siempre el efecto en el resolver de destinatarios.

## Contexto técnico
- Página `web/src/pages/Equipo.jsx`: `SegmentedControl` (equipo/stakeholder), búsqueda por nombre/rol/clientes, «Agregar persona», aviso de personas sin correo válido, grilla de `FichaPersona` (3 columnas en pantallas grandes) y `EditorPersona`.
- Datos: vista `v_persona` (con `cliente_ids` y `clientes`), RPC `guardar_persona(p_data, p_clientes, p_id)` (atómica: persona + `persona_cliente`), borrado directo `delete from persona` (cascada a `persona_cliente`; `item.responsable_id` y `acuerdo.responsable_id` pasan a `null`).
- Campos: nombre*, correo, tipo (equipo|stakeholder), rol, frecuencia de reporte (`''|Demo|Resumen semanal|Mensual`), clientes, `recibe text[]` (categorías: Bloqueantes, Vencimientos, Reprogramaciones, Ceremonias, Escalamientos, Demos, Resumen semanal), activo.
- Resolver de destinatarios: `supabase/functions/_shared/destinatarios.ts`. Reglas: `recibe` vacío = recibe TODO; quien no tiene correo válido se sustituye por el PO; stakeholders solo si el cliente del ítem está en `cliente_ids`; el rol «Líder técnico» se detecta por el texto del `rol` (`líder técnico|lider tecnico|tech lead`).
- Carga por persona: `features/equipo/carga.js` (ítems abiertos y atrasados).

## Archivos a leer
`pages/Equipo.jsx`, `features/equipo/*`, `hooks/usePersonas.js`, `api/personas.js`, `supabase/functions/_shared/destinatarios.ts`, RPC `guardar_persona`, `lib/texto.js` (`correoValido`).

## Datos de prueba
Personas: equipo con correo válido; equipo sin correo; correo inválido (`abc@`); inactivo; stakeholder de AIR-E; stakeholder sin clientes; persona con rol «Líder técnico»; nombre con tildes y ñ; nombre de 200 caracteres.

## Escenarios
| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| EQ-01 | Pestañas por tipo | Alternar equipo/stakeholder | Lista filtrada por tipo |
| EQ-02 | Búsqueda | Por nombre, rol y cliente; mayúsculas | Coincidencias en cualquiera de los tres campos |
| EQ-03 | Sin resultados | Buscar texto inexistente | «No hay personas que coincidan.» |
| EQ-04 | Aviso de correos | Con 2 personas sin correo válido en la lista visible | «2 persona(s) sin correo válido: sus alertas se redirigen al PO.» (cuenta solo las visibles) |
| EQ-05 | Ficha de equipo | Revisar | Avatar con iniciales, rol, correo o chip rojo, clientes, abiertos/atrasados con barra, chips de categorías, chip Inactivo |
| EQ-06 | Ficha de stakeholder | Revisar | «Reporte: …» en lugar de la carga |
| EQ-07 | Carga | Persona con 3 abiertos y 1 atrasado | «3 · 1 atrasados»; barra ámbar; barra proporcional al máximo del grupo |
| EQ-08 | Crear persona | Completar y «Agregar» | Aparece en la lista; toast; `persona_cliente` poblado |
| EQ-09 | Nombre vacío / solo espacios | Guardar | «El nombre es obligatorio.» |
| EQ-10 | Correo inválido | `abc@` | Se guarda con aviso «Ojo: el correo no parece válido…»; la persona cuenta como sin correo |
| EQ-11 | Correo duplicado | Dos personas con el mismo correo | Documentar (no hay restricción); el resolver deduplica por correo en el envío |
| EQ-12 | Categorías | Dejar todas desmarcadas | Hoy equivale a «recibe todo» (H-16); documentar como sorpresa de usabilidad |
| EQ-13 | Clientes | Asignar 2 clientes y quitar uno | `persona_cliente` refleja el cambio |
| EQ-14 | Editar | Cambiar tipo equipo→stakeholder | Cambia de pestaña/lista; sus ítems conservan `responsable_id` |
| EQ-15 | Desactivar | Quitar «Activo» | Chip Inactivo; deja de recibir alertas; no aparece como responsable seleccionable en Backlog (confirmar) |
| EQ-16 | Eliminar | «Eliminar persona» → confirmar | Mensaje con nº de ítems abiertos afectados; tras borrar, esos ítems quedan sin responsable; los acuerdos también |
| EQ-17 | Cancelar eliminación | «Cancelar» | Nada cambia |
| EQ-18 | Efecto en alertas | Stakeholder de AIR-E y bloqueo de un ítem de AIR-E | Aparece en «Si se bloquea, se avisa a» (Backlog) y recibe la alerta; con otro cliente, no |
| EQ-19 | Líder técnico | Persona con rol «Líder Técnico» (mayúsculas) | Recibe escalamientos (`lider_tecnico`) |
| EQ-20 | Persona sin correo | Responsable de un ítem bloqueado sin correo | Alerta redirigida al PO con nombre «(en lugar de …, sin correo)» |
| EQ-21 | Datos extremos | Nombre de 200 caracteres, emojis, `<img src=x onerror=alert(1)>` | Se muestra como texto; layout no se rompe |
| EQ-22 | Fallo del servidor | Cortar la red al guardar/eliminar | Debe verse un mensaje de error (hoy no, H-05) |
| EQ-23 | Doble envío | Doble clic en «Guardar» al crear | Una sola persona creada |

## Puntos sospechosos
- `features/equipo/EditorPersona.jsx:66,77`: `await` sin `try/catch` (H-05).
- `_shared/destinatarios.ts:22-23`: `recibe` vacío significa «todo» (H-16).
- `EditorPersona.jsx:62`: no hay validación de correo al guardar (solo aviso posterior); tampoco hay restricción única en `persona.correo`.
- `Equipo.jsx:37` y `:23`: la carga se calcula en el cliente sobre `useItems` (tope 1 000, H-03).
- La eliminación de una persona deja `responsable_id = null` sin dejar rastro en la bitácora de los ítems.

## Evidencia a capturar
Capturas de ficha/editor, filas de `persona`/`persona_cliente`, respuesta de `guardar_persona`, y la lista devuelta por `alertas/destinatarios` para las reglas afectadas.

## Severidad y prioridad
Un destinatario equivocado/ausente en alertas = S1/S2 (P1). Falta de validación = S3. Cosmético = S4.

## Formato de salida
| ID | Escenario | Resultado | Evidencia | Bug (ID, S/P) |
Después: bugs con la plantilla `98` y tres recomendaciones.
