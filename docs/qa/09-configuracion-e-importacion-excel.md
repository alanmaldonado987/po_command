# 09 · Prueba funcional: Configuración & Datos (`/configuracion`) — catálogos, importación y exportación de Excel

> Copia todo este archivo como prompt. Prefijo de casos: **CF**.

## Rol y mentalidad
QA senior de datos y migraciones: tratas la importación como una operación destructiva en potencia. Verificas conteos, idempotencia, normalización y que nada se pierda en silencio. Ensayas archivos hostiles.

## Contexto técnico
- Página `web/src/pages/Configuracion.jsx`: tarjetas `TarjetaPo` (`config.po_nombre`, `po_correo`), `TarjetaCorreo` (resumen), `TarjetaBaseDatos` + `BotonRespaldo`; pestañas Catálogos, Importar, Exportar, Auditoría. «Reiniciar base» y «Cerrar la aplicación» ya NO existen.
- Catálogos (`PestanaCatalogos`, `FilaCatalogo`): clientes (estado), actividades, módulos (producto), productos (estado). Alta, edición por fila y borrado con confirmación que informa cuántos ítems lo usan (conteo calculado en el cliente con `useItems`). Nombre único (`unique`); mensaje «Ya existe un registro con ese nombre.». Borrar un registro deja `*_id = null` en los ítems (`on delete set null`); borrar un cliente borra `persona_cliente` (cascada).
- Importación: `lib/excel/leerPlan.js` (SheetJS, `cellDates`, celdas combinadas, columnas por encabezado, fase por defecto desde la fila superior, estado deducido), `normalizar.js` (alias), `consideraciones.js` (notas por fecha), `prepararFilas.js` (clave `cliente|actividad|modulo|funcionalidad|fase|alcance`, sufijo `#n` para repetidas) y RPC `importar_plan(p_filas jsonb, p_simular, p_producto)`.
- Archivo de ejemplo: `data_inicial/plan_de_trabajo.xlsx` → 274 filas (AIR-E 114, AFINIA 65, ELECTROHUILA 59, ACUACAR 36), 152 consideraciones, 3 avisos.
- Reglas de la RPC: busca por `clave_importacion`; responsable por nombre sin tildes/mayúsculas (crea persona de equipo «Developer» sin correo si no existe); producto por columna o «FieldOps»; si el estado fue deducido y el ítem existe, conserva el estado; conserva descripción y bloqueos; cambios de fechas planificadas → bitácora «Reprogramación»; notas nuevas por texto normalizado (no duplica); auditoría «importar».
- Exportación: `exportarPlan.js` (una hoja por cliente, mismas columnas, fechas `dd/mm/yyyy`, notas por tipo) y `exportarTablas.js`/`respaldo.js` (15 tablas, `leerTabla` con `.limit(50000)`).

## Archivos a leer
`features/configuracion/*`, `lib/excel/*` (y `excel.test.js`), `api/configuracion.js`, RPC `importar_plan` y `guardar_item` (`supabase/migrations/...003_funciones.sql`).

## Datos de prueba
Excel de ejemplo; copia modificada (fechas cambiadas, filas nuevas, notas nuevas, responsable nuevo); libros inválidos: sin encabezados, sin columnas obligatorias, hoja vacía, 5 000 filas, `.xlsx` corrupto, `.xls`, `.csv` renombrado, fechas como texto, celdas con fórmulas, texto con `<script>`, nombres de hoja de 31 caracteres con símbolos.

## Escenarios
| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| CF-01 | Datos del PO | Cambiar nombre y correo | Persisten; correo con tipo email; vacío permitido (documentar efecto en alertas) |
| CF-02 | Correo del PO inválido | `abc` | El navegador lo rechaza (`type=email`); probar por API (sin validación en servidor) |
| CF-03 | Fallo al guardar | Cortar red | Toast de error (sí existe en esta pantalla) |
| CF-04 | Tarjeta de correo | Revisar | Estado Simulación/Configurado/Sin configurar coherente con `smtp_config` |
| CF-05 | Tarjeta de base de datos | Revisar | Conteo de ítems correcto |
| CF-06 | Respaldo completo | Descargar | `.xlsx` con una hoja por cada una de las 15 tablas, sin `smtp_config` |
| CF-07 | Respaldo con >1 000 filas | Volumen | Documentar truncamiento silencioso (H-03) |
| CF-08 | Catálogo: alta | Crear cliente «QA-1» | Aparece primero (fila de alta) y en filtros/formularios |
| CF-09 | Duplicado | Mismo nombre y misma con otra capitalización | Error claro; con capitalización distinta confirmar el comportamiento (`unique` distingue mayúsculas) |
| CF-10 | Nombre vacío | Guardar | Botón deshabilitado |
| CF-11 | Renombrar | Cambiar «ACUACAR» | Todos los ítems muestran el nuevo nombre (misma `id`) |
| CF-12 | Estado de cliente/producto | Activo/Pausado/Cerrado | Cliente `Pausado` no cuenta en «Clientes» del Centro de Mando |
| CF-13 | Módulo con producto | Asignar y quitar producto | Persiste |
| CF-14 | Uso | Revisar el chip «N ítems» | Coincide con SQL |
| CF-15 | Eliminar con uso | «Eliminar» → «Sí» en un cliente con ítems | Los ítems quedan sin cliente; las personas pierden el vínculo; sin rastro en la UI (documentar riesgo) |
| CF-16 | Eliminar y cancelar | «No» | Nada cambia |
| CF-17 | Eliminar producto con módulos | Revisar | `modulo.producto_id` queda `null` |
| CF-18 | Descripción larga / HTML | Pegar `<b>x</b>` | Texto plano |
| CF-19 | Leer el archivo de ejemplo | Subir el `.xlsx` | 274 filas leídas; vista previa con conteos «N nuevas · M ya existen»; 3 avisos listados |
| CF-20 | Previa no escribe | Subir y NO confirmar | Cero cambios en la base (RPC con `simular=true`) |
| CF-21 | Importar | Confirmar | Resultado «274 nuevos…, 152 notas»; personas nuevas listadas; auditoría «importar» |
| CF-22 | Idempotencia | Importar el mismo archivo dos veces | 2.ª vez: 0 nuevos, 274 sin cambios, 0 notas; sin reprogramaciones |
| CF-23 | Actualización con cambios | Cambiar 3 `plan_fin` y 2 consideraciones | 3 ítems con cambio, 3 notas «Reprogramación», 2 notas nuevas; nada más cambia |
| CF-24 | Conserva datos locales | Ítem con descripción y bloqueo en la app, reimportar | Se conservan |
| CF-25 | Estado deducido | Fila sin estado: con fecha real / sin ella; ítem existente | «En curso»/«No iniciado»; en ítems existentes conserva el estado actual |
| CF-26 | Normalización | «Cutomización», «Ordenes», «Luis Kendor» | «Customización», «Órdenes», «Luis Kendor Narvaez» |
| CF-27 | Filas repetidas | Dos filas con la misma clave | Se crean 2 ítems (`#2`); al reimportar no se duplican |
| CF-28 | Responsable nuevo | Nombre inexistente | Persona creada sin correo y rol Developer; aviso en la previa |
| CF-29 | Fechas | Texto `2026-03-01`, serial de Excel, celda vacía, año de 2 dígitos, fin de semana | Fechas correctas sin desfase de un día (SheetJS suma 12 h) |
| CF-30 | Notas con fecha | «25AGO: …», «Sept 22: …», sin fecha | Fecha de la nota por el prefijo (año del `plan_ini`); sin fecha → hoy; líneas sin fecha se unen a la anterior |
| CF-31 | Archivo inválido | Sin encabezados / sin columnas / vacío / corrupto / `.xls` / `.csv` | Mensaje claro, sin cuelgue, sin cambios en la base |
| CF-32 | Archivo enorme | 5 000 filas | Medir tiempo; documentar timeout del servidor y que la transacción se revierte (H-08) |
| CF-33 | Contenido hostil | `=HYPERLINK(...)`, `<script>`, 10 000 caracteres | Texto plano en la app; al exportar no se convierten en fórmulas |
| CF-34 | Fallo a mitad | Cortar red al confirmar | Mensaje de error; la base queda sin cambios (atómica); reintento posible |
| CF-35 | Exportar Plan | Descargar | Hojas por cliente, columnas y merges como el original, fechas `dd/mm/yyyy`, notas por tipo (Planificación/Reprogramación vs Ejecución/Seguimiento/Bloqueo) |
| CF-36 | Ida y vuelta | Exportar y reimportar | 0 cambios (comprobar que el export contiene lo necesario para reconocer cada fila) |
| CF-37 | Nombres de hoja | Clientes con `[]:*?/\` o de 40 caracteres o duplicados | Hojas válidas únicas ≤ 31 caracteres |
| CF-38 | Exportar sin datos | Base vacía | Botón deshabilitado |
| CF-39 | Auditoría | Crear/editar/borrar cosas | Lista (500 máx.) con fecha, entidad, id, acción, detalle |
| CF-40 | Auditoría sin falsificaciones | Revisar entradas | Solo las generadas por triggers/RPC (ver H-02 para falsificación anónima) |
| CF-41 | Funciones eliminadas | Buscar «Reiniciar base» y «Cerrar la aplicación» | No existen |

## Puntos sospechosos
- `api/configuracion.js:41`: `.limit(50000)` no supera el `max_rows` del servidor (1 000) → respaldo incompleto sin aviso (H-03).
- `PestanaImportar.jsx:58,67`: una sola llamada con todas las filas (H-08).
- `leerPlan.js:11,93`: año por defecto 2026 y el año de las notas sale de `plan_ini`; notas de enero en planes que empiezan en diciembre quedan en el año equivocado.
- `leerPlan.js:9,14`: ajuste de +12 h para compensar la zona horaria; verificar en zonas extremas.
- `package.json`: `xlsx@0.18.5` con avisos de seguridad (H-22); probar un libro malicioso.
- `FilaCatalogo.jsx:65-66`: la confirmación muestra usos, pero no avisa del efecto sobre personas (cascada de `persona_cliente`).
- `catalogos.js:35`: detección de duplicado por texto del error (`duplicate key|unique`); error de otro idioma no se traduce.
- El código `BL-nnn` sale de la secuencia `item_codigo_seq`: no se reutiliza al borrar (habrá huecos) y no se reinicia al reimportar; confirmar que mezclar altas manuales e importaciones nunca repite un código.

## Evidencia a capturar
Archivo usado, capturas de la previa y del resultado, conteos SQL antes/después (`item`, `nota`, `persona`, `auditoria`), `.xlsx` exportado abierto en Excel/LibreOffice, tiempos.

## Severidad y prioridad
Pérdida o duplicado de datos en importación = S1/S2 (P1). Respaldo incompleto sin aviso = S2. Mensajes = S3/S4.

## Formato de salida
| ID | Escenario | Resultado | Evidencia | Bug (ID, S/P) |
Después: bugs con la plantilla `98` y tres recomendaciones.
