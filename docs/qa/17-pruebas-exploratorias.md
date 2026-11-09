# 17 · Pruebas exploratorias (charters, SFDIPOT y tours)

> Copia todo este archivo como prompt. Prefijo de casos: **EX**. Sesiones de 60–90 minutos con tiempo limitado (timebox), notas en vivo y debrief al final.

## Rol y mentalidad
Tester exploratorio senior: aprendes, diseñas y ejecutas pruebas al mismo tiempo, guiado por riesgo e intuición. Sospechas de los supuestos, buscas **oráculos** (HICCUPPS: History, Image, Comparable products, Claims, User expectations, Product, Purpose, Statutes) y registras preguntas, riesgos y bugs.

## Contexto técnico
La app reemplaza a una versión Streamlit del Plan de Trabajo. Usuario único (PO) con datos compartidos. Flujo núcleo: importar plan → revisar tablero → editar ítems (fechas, bloqueos, notas) → alertas por correo (simuladas o reales) → ceremonias y acuerdos → análisis. Rutas: `/`, `/backlog`, `/cronograma`, `/ceremonias`, `/equipo`, `/alertas`, `/analitica`, `/asistente`, `/configuracion`. Backend: tablas con RLS, RPC (`guardar_item`, `importar_plan`, …), Edge Functions `alertas`/`correo`/`ia`. Antes de explorar lee `hallazgos-iniciales.md` y el README de `supabase/`.

## Archivos a leer
`web/src/routes.js`, `web/src/pages/*.jsx`, `supabase/README.md`, `docs/qa/hallazgos-iniciales.md`, `supabase/migrations/20261106000003_funciones.sql`.

## Datos de prueba
Plan importado, personas y ceremonias de prueba, `dry_run = true`, SMTP sandbox disponible, dos navegadores/perfiles.

## Hoja de sesión (plantilla)
```
Charter: <Explora X con Y para descubrir Z>
Tester / fecha / duración / build
Áreas cubiertas · Notas · Preguntas · Riesgos · Bugs (ID) · % tiempo en: diseño de pruebas / ejecución / investigación de bugs / configuración
```

## Charters (cada uno es un caso EX)
| ID | Charter | Foco / oráculos |
|---|---|---|
| EX-01 | Explora el **ciclo de vida de un ítem** (crear → planificar → ejecutar → bloquear → desbloquear → terminar → reabrir → eliminar) con distintos estados y fechas para descubrir inconsistencias en atraso, bitácora y alertas | Historia; reglas de `guardar_item` |
| EX-02 | Explora la **importación de Excel** con archivos alterados (columnas movidas, hojas extra, celdas combinadas, fechas como texto) para descubrir pérdida o duplicado de datos | Claims (README), producto comparable (Excel original) |
| EX-03 | Explora el **motor de alertas** manipulando fechas en SQL para descubrir correos duplicados, ausentes o a destinatarios incorrectos | Propósito; MA-xx |
| EX-04 | Explora **bloqueos y escalamientos** con personas sin correo, sin cliente o inactivas para descubrir huecos en la resolución de destinatarios | Expectativas del usuario |
| EX-05 | Explora la **seguridad desde fuera** (clave pública, tokens alterados, funciones) para descubrir accesos no autorizados | Estatutos; AU/SE |
| EX-06 | Explora **dos sesiones simultáneas** editando lo mismo para descubrir pérdidas de cambios | Producto; DB-18 |
| EX-07 | Explora **errores de red** a mitad de cada operación (guardar, importar, enviar, resolver) para descubrir estados a medias y mensajes ausentes | Imagen; RS-xx |
| EX-08 | Explora **volumen** (1 000+ ítems, 5 000 notas) para descubrir truncamientos silenciosos y lentitud | Producto; RN-xx |
| EX-09 | Explora la **zona horaria y los cambios de día** para descubrir fechas desplazadas | Comparables; RC-17…20 |
| EX-10 | Explora el **asistente** con frases coloquiales, errores ortográficos y combinaciones de palabras para descubrir intenciones equivocadas | Expectativas |
| EX-11 | Explora **catálogos y renombrados** (clientes, actividades, módulos) para descubrir efectos en filtros, alertas y exportaciones | Historia |
| EX-12 | Explora **accesibilidad con teclado solo** durante un día de trabajo típico | WCAG |
| EX-13 | Explora **datos hostiles** (HTML, Unicode, textos largos, emojis, vacíos) en todos los campos | SE-01…03 |
| EX-14 | Explora **la primera hora de un usuario nuevo** (sin leer documentación) para descubrir fricción | Expectativas |
| EX-15 | Explora **la salida a producción** (variables, correo real, `app_url`, cron, registro público) para descubrir configuraciones inseguras o incompletas | Propósito; HU-xx |
| EX-16 | Explora **exportar e importar de vuelta** para descubrir cambios no deseados o pérdida de información | Producto comparable |
| EX-17 | Explora **los números**: compara cada KPI y gráfico con SQL propio para descubrir diferencias de definición | Consistencia interna |
| EX-18 | Explora **el estado de la interfaz tras acciones** (selección, filtros, formularios abiertos) para descubrir estados obsoletos (por ejemplo, editar ítem A y luego B) | Imagen |

## Heurística SFDIPOT aplicada
| Dimensión | Preguntas guía para esta app |
|---|---|
| **S**tructure | ¿Qué pasa si falla una Edge Function, la vista `v_item` o el cron? ¿Dependencias (Google Fonts, Supabase, SMTP, `xlsx`)? |
| **F**unction | ¿Qué hace cada acción con valores nulos, repetidos, en el límite? ¿Hay efectos secundarios (alertas, auditoría)? |
| **D**ata | Fechas límite, nulos, vacío vs null, cadenas largas, Unicode, 0/1/muchos ítems, 1 000 vs 1 001 |
| **I**nterfaces | UI, PostgREST, RPC, funciones, correo, Excel (formatos), asistente |
| **P**latform | Navegadores, móvil, zona horaria, red, plan de Supabase |
| **O**perations | Uso diario del PO, importaciones semanales, cron cada 15 min, respaldo, restauración |
| **T**ime | Medianoche de Bogotá, lunes, semana ISO, 24 h/48 h, reintentos a 10 min, sesiones que caducan |

## Tours
| Tour | Qué hacer en esta app |
|---|---|
| Del dinero | Probar lo más valioso: alertas correctas y datos íntegros del plan |
| De los puntos de referencia | Recorrer las 9 pantallas y volver; comprobar coherencia entre ellas |
| Del saboteador | Cortar la red, cerrar pestañas a mitad, doble clic, atrás/adelante |
| Del callejón | Funciones poco usadas: duplicar ítem, reintentar alertas, reenviar invitación, catálogos |
| Antisocial | Entradas inválidas: fechas absurdas, correo mal formado, archivos incorrectos |
| Del cabezón | Repetir la misma acción 50 veces (guardar, escalar) |
| Del recolector de basura | Datos viejos: ítems eliminados, bloqueos resueltos, alertas canceladas |
| De la superestrella | Casos de la vida real del PO: lunes de resumen, final de sprint, demo con cliente |
| Del turista | Primer uso sin guía |
| De la noche entera | Dejar la app abierta 8 h y operar de nuevo (sesión, caché) |

## Puntos sospechosos para dirigir la exploración
`FormularioItem.jsx:42` (aviso tragado), `EditorAcuerdos.jsx:58-78` (estado local), `TarjetaRegla.jsx:25` (hora corregida en silencio), `api/items.js:32` (notas truncadas), `cola.ts:29-40` (registros «Omitida»), `correo/index.ts:24-41` (cambio de host), `DataTable.jsx:55-60` (teclado), `fechas.js:13` (zona horaria), `ToastContext.jsx:11` (contexto no seguro), `semillas.sql:3-4` (correo real y localhost).

## Evidencia a capturar
Notas de sesión, vídeo, capturas, consultas SQL, bugs con la plantilla `98`, preguntas abiertas para el PO.

## Severidad y prioridad
La del bug encontrado (escala README). Registrar también «riesgos sin probar».

## Formato de salida
| ID | Charter | Duración | Hallazgos (bugs, riesgos, preguntas) | Evidencia | Cobertura SFDIPOT |
Al final: mapa mental de cobertura y las 5 áreas que más merecen automatización.
