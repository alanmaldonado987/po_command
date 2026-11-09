# 02 · Prueba funcional: Backlog · Plan de Trabajo (`/backlog`)

> Copia todo este archivo como prompt. Prefijo de casos: **BL**.

## Rol y mentalidad
QA senior orientado a datos: cada guardado debe verificarse en la base (columnas, bitácora, bloqueantes, auditoría, alertas). Piensas en combinaciones raras de fechas, estados y bloqueos, y en lo que pasa cuando algo falla a mitad.

## Contexto técnico
- Página `web/src/pages/Backlog.jsx` → `FiltrosBacklog`, `TablaBacklog`, `EditorItem` (`FormularioItem` + `PanelBitacora`, `PanelDestinatarios`, `PanelAcciones`, `PanelAyuda`).
- Guardado: RPC `guardar_item(p_data jsonb, p_id, p_nota, p_tipo_nota, p_autor)` (`supabase/migrations/20261106000003_funciones.sql:123-256`). Acepta nombres `producto`, `cliente`, `actividad`, `modulo` y crea el catálogo si no existe. Devuelve `{id, codigo, antes:{bloqueado, motivo_bloqueo}|null, cambios:[{campo,antes,despues}], sin_cambios}`. Después el navegador llama a `alertas/item_guardado`.
- Reglas en la RPC: `terminado_en` al pasar a `Terminado` (usa `real_pruebas_fin`, `real_fin` u hoy Bogotá); nota automática «Cambio de fechas · inicio planificado: dd/mm/aaaa → …» (autor «Automática») solo para las 4 fechas planificadas; bloqueo: crea `bloqueante` (severidad `Alta` si hay atraso) y nota «Bloqueado: …»; desbloqueo: cierra el bloqueante, nota «Bloqueo resuelto: …» y cancela alertas `BLOQUEO_ESCALAR`; si no hay cambios y no hay nota devuelve `sin_cambios: true` sin escribir.
- Borrado lógico: `eliminar_item` (`eliminado_en`, cierra bloqueos, cancela alertas, devuelve nº canceladas). Vista `v_item` oculta eliminados. Código `BL-nnn` por la secuencia `item_codigo_seq`.
- Validación del formulario: `features/backlog/valoresFormulario.js` (obligatorios: cliente, actividad, módulo, funcionalidad, alcance; fin ≥ inicio por tramo; motivo si bloqueado).

## Archivos a leer
`pages/Backlog.jsx`, `features/backlog/*`, `hooks/useItems.js`, `api/items.js`, `lib/dominio.js`, la RPC `guardar_item` y `eliminar_item`, y el trigger `auditar`.

## Datos de prueba
Plan importado; personas de equipo con y sin correo; un stakeholder asignado a AIR-E; un ítem con 3 notas; un ítem bloqueado con atraso.

## Escenarios
| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| BL-01 | Búsqueda por código | Escribir `BL-001` | Solo ese ítem |
| BL-02 | Búsqueda por funcionalidad/descripción/nota | Escribir texto que está solo en una nota | Aparece el ítem dueño de la nota |
| BL-03 | Búsqueda con mayúsculas/acentos | `ÓRDENES`, `ordenes` | Documentar si distingue acentos (el original no normaliza) |
| BL-04 | Filtros de lista (producto, cliente, actividad, módulo, responsable, alcance, fase) | Combinar 3 filtros | Intersección (AND entre filtros, OR dentro de uno) |
| BL-05 | Filtro Estado con «Bloqueado» y «Atrasado» | Seleccionar ambos | Unión de estado literal, bloqueados y atrasados no cerrados |
| BL-06 | Opciones de filtro | Revisar listas | Alcances/fases incluyen los de los datos y los predeterminados |
| BL-07 | Limpiar filtros | Quitar selecciones | Vuelve a todos |
| BL-08 | Sin resultados | Texto inexistente | «No hay ítems que coincidan con el filtro.»; título de la tarjeta «0 ítems · 0 abiertos · 0 atrasados» |
| BL-09 | Conteos de la tarjeta | Aplicar filtro | `N ítems · M abiertos · K atrasados` sobre los filtrados |
| BL-10 | Selección de fila | Clic en fila; Tab/Enter | Abre el editor; la fila queda resaltada; **probar con teclado** (H-14) |
| BL-11 | Columnas | Revisar | Fin planificado = `plan_pruebas_fin` o `plan_fin`; Estado «Bloqueado» si bloqueado; Atraso vacío si 0; código fijo al desplazar |
| BL-12 | Descargar Excel | Con y sin filtros | `.xlsx` con una hoja por cliente, mismas columnas que el Plan, fechas dd/mm/aaaa, notas por tipo; botón deshabilitado sin ítems |
| BL-13 | Crear ítem mínimo | Completar obligatorios | Código `BL-nnn` consecutivo; toast «BL-nnn guardado…»; aparece en la tabla |
| BL-14 | Catálogo nuevo en línea | Escribir cliente/actividad/módulo/producto nuevos | Se crean en su catálogo; reutilizar el mismo nombre con otra capitalización NO crea duplicado |
| BL-15 | Campos obligatorios | Dejar cada uno vacío | Mensaje «Completa los campos con *…»; no se llama a la RPC |
| BL-16 | Rangos de fechas | Fin < inicio en cada uno de los 4 tramos | Mensaje por tramo; documentar que el servidor NO lo valida (H-17) |
| BL-17 | Bloqueo sin motivo | Marcar bloqueado y dejar vacío | Mensaje «Indica el motivo…» |
| BL-18 | Bloquear ítem | Marcar bloqueado + motivo | `bloqueante` abierto; nota «Bloqueado: …»; alerta `BLOQUEO_NUEVO` encolada para responsable, PO y stakeholders del cliente; mensaje con nº de destinatarios |
| BL-19 | Bloquear sin destinatarios válidos | Sin correos | Mensaje «Bloqueo registrado, pero no hay destinatarios con correo válido.» |
| BL-20 | Desbloquear | Desmarcar | Bloqueo cerrado, nota, `BLOQUEO_RESUELTO` encolada, escalamientos cancelados |
| BL-21 | Reprogramar | Cambiar `plan_fin` | Nota automática «Cambio de fechas · fin planificado: a → b»; alerta `REPROGRAMACION`; toast incluye «Cambio de fechas registrado…» |
| BL-22 | Cambiar fechas ejecutadas | Cambiar `real_fin` | NO genera reprogramación |
| BL-23 | Terminar ítem | Estado `Terminado` sin y con `real_pruebas_fin` | `terminado_en` correcto; atraso se congela (entrega − compromiso) |
| BL-24 | Reabrir ítem | `Terminado` → `En curso` | `terminado_en = null`; vuelve a contar como abierto |
| BL-25 | Guardar sin cambios | Abrir y guardar | Sin nuevas filas en `nota`/`auditoria`; sin correo |
| BL-26 | Duplicar | «Duplicar ítem» | Formulario nuevo prellenado (título «copia de BL-…»); al guardar, código nuevo; el original no cambia; bloqueos no se copian |
| BL-27 | Nota manual por tipo | Seguimiento/Planificación/Ejecución | Nota con autor = `config.po_nombre` y fecha de hoy |
| BL-28 | Bitácora orden | Varias notas | Más recientes primero; chips de tipo con color |
| BL-29 | Eliminar nota | Borrar una nota | Desaparece; sin confirmación (documentar); no hay auditoría |
| BL-30 | Notas largas / HTML | `<script>alert(1)</script>`, 10 000 caracteres | Se muestra como texto; layout intacto |
| BL-31 | Destinatarios de bloqueo | Abrir panel | Lista del resolver (responsable, PO, stakeholders del cliente del ítem); aviso si no hay |
| BL-32 | Ítem sin responsable | Guardar bloqueado | Alerta solo a PO y stakeholders |
| BL-33 | Responsable inactivo o sin correo | Bloquear | Se redirige al PO con nombre «(en lugar de …, sin correo)» |
| BL-34 | Eliminar con confirmación | Eliminar → «Sí, eliminar» | Toast con nº de alertas canceladas; `eliminado_en` poblado; bloqueo cerrado; desaparece de todo el sistema |
| BL-35 | Cancelar eliminación | «Cancelar» | Nada cambia |
| BL-36 | Eliminar con alertas pendientes | Ítem con 2 alertas pendientes | Quedan `Cancelada` |
| BL-37 | Auditoría | Crear/editar/eliminar | Filas `crear`/`editar`/`eliminar` con «BL-nnn funcionalidad» |
| BL-38 | Concurrencia | Editar el mismo ítem en dos pestañas | Documentar sobrescritura silenciosa (H-12) |
| BL-39 | Cambiar de ítem con el editor abierto | Abrir BL-001, luego BL-002 | El formulario muestra los datos de BL-002 (comprobar la clave de `EditorItem.jsx:10`) |
| BL-40 | Fallo del servidor | Cortar la red al guardar | Mensaje de error visible en el formulario; sin doble guardado al reintentar |
| BL-41 | Fallo de aviso | Detener la función `alertas` y guardar un bloqueo | El ítem se guarda; el toast indica «No se pudo avisar…»; documentar que no hay reintento (H-06) |
| BL-42 | Muchos ítems | 1 200 ítems | Tabla usable; documentar truncamiento a 1 000 (H-03) y tiempo de carga |

## Puntos sospechosos
- `features/backlog/useFiltrosBacklog.js:32-34` y `TablaBacklog.jsx:30`: la búsqueda y la exportación dependen de `useTodasLasNotas` (sin `order`, tope 1 000; H-03).
- `valoresFormulario.js:44` valida orden de fechas solo en el cliente; `guardar_item` no (H-17).
- `valoresFormulario.js:54-70` envía el registro completo → sobrescritura (H-12).
- `FormularioItem.jsx:42` traga el fallo del aviso (`.catch`) y continúa (H-06).
- `PanelBitacora.jsx` elimina notas sin confirmar ni auditar.
- `guardar_item` convierte el motivo vacío de un bloqueo en «Motivo pendiente…» cuando se llama por API sin motivo.

## Evidencia a capturar
Capturas del formulario y de la tabla, respuesta de la RPC, filas de `item`, `nota`, `bloqueante`, `alerta_programada` y `auditoria` antes/después (consulta SQL), consola del navegador.

## Severidad y prioridad
Pérdida o corrupción de datos, alerta ausente/duplicada = S1/S2 (P1). Validación faltante = S3. Texto/estilo = S4.

## Formato de salida
| ID | Escenario | Resultado (PASA/FALLA/BLOQUEADO/N-A) | Evidencia | Bug (ID, S/P) |
Después: bugs con la plantilla `98` y tres recomendaciones.
