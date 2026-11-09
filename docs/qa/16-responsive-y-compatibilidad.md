# 16 · Responsive, compatibilidad de navegadores y zonas horarias

> Copia todo este archivo como prompt. Prefijo de casos: **RC**.

## Rol y mentalidad
QA de compatibilidad: asumes que «en mi máquina funciona» no significa nada. Pruebas en dispositivos reales o emulados, con redes distintas y con zonas horarias distintas a la de Colombia.

## Contexto técnico
- Tailwind v3 con puntos de corte estándar (`sm` 640, `md` 768, `lg` 1024, `xl` 1280). Barra lateral fija de 280 px visible desde `lg` (`components/layout/AppLayout.jsx`); por debajo, menú hamburguesa con capa oscura. Contenedor `max-w-[1320px]` con paddings `px-8 / max-lg:px-5 / max-sm:px-3`.
- Rejillas: `lg:grid-cols-12` (Centro), `lg:grid-cols-5` (Ceremonias), `grid-cols-[3fr_2fr] max-lg:grid-cols-1` (editor de ítem), `md:grid-cols-2` (Analítica, reglas), `sm:grid-cols-2 xl:grid-cols-3` (fichas del equipo), KPIs `repeat(auto-fit, minmax(min(170px,100%),1fr))`.
- Elementos propensos a desborde: `DataTable` (14 columnas, scroll interno), `GanttChart` (scroll horizontal, etiqueta fija de 280 px), `Hero` con insignias, popovers (`Popover.jsx`, anchura mínima), `ComboField` con `datalist`.
- APIs del navegador: `crypto.randomUUID()` (solo en contextos seguros: HTTPS o `localhost`) en `context/ToastContext.jsx:11`, `features/asistente/useAsistente.js:61,69,73`, `features/ceremonias/EditorAcuerdos.jsx:18`; `String.prototype.replaceAll` (Chrome 85+, Safari 13.1+) en `TablaBacklog.jsx:34`, `PestanaExportar.jsx:13`, `respaldo.js:9`; `<input type="date|time">`; `<details>`; `datalist`; `Intl`; `Blob`/descarga de archivos (`lib/excel/descargar.js`).
- Zonas horarias: el navegador calcula «hoy» y formatea hora local (`lib/fechas.js`), mientras la base y las funciones usan America/Bogota (`public.hoy()`, `_shared/tiempo.ts`).
- Fuentes e iconos: Inter y Material Symbols desde Google Fonts (`web/index.html:8-16`).

## Archivos a leer
`components/layout/*`, `components/ui/DataTable.jsx`, `components/charts/GanttChart.jsx`, `lib/fechas.js`, `index.html`, `index.css`, `tailwind.config.js`.

## Datos de prueba
Plan importado; usuario PO; dispositivos o emuladores: iPhone SE/14, Android mediano, iPad, laptop 1366×768, monitor 1920×1080 y 2560×1440; navegadores: Chrome y Edge (actual y anterior), Firefox (actual y ESR), Safari (macOS e iOS).

## Escenarios
| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| RC-01 | Anchos clave | 320, 375, 414, 768, 1024, 1280, 1920 px en cada ruta | Sin desbordamiento horizontal de la página; contenido legible |
| RC-02 | Menú móvil | Abrir/cerrar hamburguesa, navegar, tocar la capa | Cierra al navegar y al tocar fuera; el foco no se pierde |
| RC-03 | Tablas | Backlog y cola en 375 px | Scroll horizontal interno; columna Código fija; sin recortar acciones |
| RC-04 | Formularios largos | Formulario de ítem en móvil | Campos en una columna; teclado virtual no tapa el botón Guardar; teclado numérico/fecha adecuados |
| RC-05 | Gantt móvil | Pellizcar/desplazar | Scroll interno; etiqueta fija legible |
| RC-06 | Popovers y listas | Multiselección en 320 px | No salen de la pantalla ni quedan cortados |
| RC-07 | Rotación | Girar el dispositivo | Diseño se adapta sin perder estado |
| RC-08 | Pantallas grandes | 2560 px | Contenido centrado, sin estiramientos |
| RC-09 | Zoom del navegador | 50 %, 100 %, 200 % | Usable |
| RC-10 | Chrome / Edge | Flujo completo (humo del prompt 18) | Sin errores de consola |
| RC-11 | Firefox | Idem | Selectores de fecha/hora y `datalist` usables; descargas Excel correctas |
| RC-12 | Safari macOS/iOS | Idem | `crypto.randomUUID`, `replaceAll`, `details`, fechas y descarga de `.xlsx` funcionan; `<input type=time>` correcto |
| RC-13 | Navegador anterior | Chrome/Safari 2 versiones atrás | Degrada con mensaje o funciona; documentar versión mínima |
| RC-14 | Contexto no seguro | Abrir `http://<IP-de-la-LAN>:5173` desde otro equipo | `crypto.randomUUID` no existe: los avisos (toast), el asistente y los acuerdos nuevos fallan (H-24); en HTTPS/localhost funcionan |
| RC-15 | Descargas | Exportar `.xlsx` en cada navegador y en móvil | Se descarga con el nombre `Plan_de_Trabajo_AAAAMMDD.xlsx`; se abre en Excel/LibreOffice |
| RC-16 | Carga de archivos | Subir `.xlsx` en móvil (selector del sistema) | Funciona o mensaje claro |
| RC-17 | Zona UTC+9 (Tokio) | Cambiar la zona del sistema y recargar | «Hoy» del Cronograma, «por vencer» y «Alertas hoy» coherentes; documentar diferencias con el servidor (H-09) |
| RC-18 | Zona UTC-8 (Los Ángeles) | Idem | Idem; ceremonia creada a las 09:00 locales: ¿qué hora ve el PO en Bogotá y qué hora aparece en el correo? |
| RC-19 | Cambio de horario de verano | Zona con DST (p. ej. Nueva York) en la fecha de cambio | Ceremonias y fechas no se desplazan una hora ni un día |
| RC-20 | Medianoche | A las 23:30 y 00:30 de Bogotá, comparar `hoy` de la app y `public.hoy()` | Mismas fechas de atraso (H-09/H-23) |
| RC-21 | Idioma del navegador | Inglés | La app sigue en español; formatos de fecha dd/mm/aaaa propios; selectores nativos pueden variar |
| RC-22 | Iconos sin red de fuentes | Bloquear `fonts.googleapis.com`/`gstatic` | Interfaz usable; los iconos no aparecen como texto largo desbordando botones y menú |
| RC-23 | Red lenta | «Slow 3G» | Indicadores de carga; sin pantallas rotas ni dobles envíos |
| RC-24 | Modo oscuro del sistema | Activar | La app no debe quedar ilegible (tema claro fijo); documentar |
| RC-25 | Extensiones | Bloqueadores de anuncios/privacidad | Sin romper llamadas a Supabase |
| RC-26 | Impresión | Imprimir una página | Documentar (no se exige) |
| RC-27 | Almacenamiento bloqueado | Navegación privada/cookies de terceros bloqueadas | El inicio de sesión funciona o muestra un error claro (la sesión usa `localStorage`) |
| RC-28 | Varias pestañas | 3 pestañas y cerrar sesión en una | Todas coherentes (ver AU-08) |

## Puntos sospechosos
- `context/ToastContext.jsx:11`, `features/asistente/useAsistente.js:61,69,73`, `features/ceremonias/EditorAcuerdos.jsx:18`: `crypto.randomUUID()` falla en HTTP no seguro (H-24).
- `lib/fechas.js:13` (`hoyIso`), `:52-58`: zona horaria del navegador (H-09); `features/centro/ProximasAlertas.jsx:12` (H-23).
- `web/index.html:8-16`: dependencia de Google Fonts para los iconos.
- `components/layout/AppLayout.jsx`: la barra lateral usa `translate-x` sin `inert`/`aria-hidden` cuando está cerrada en móvil (el foco puede entrar en un panel oculto).
- `components/ui/Popover.jsx`: posicionamiento absoluto sin detección de bordes.

## Evidencia a capturar
Capturas por dispositivo/navegador (ancho, versión), vídeo de los flujos, consola, valores de `new Date().getTimezoneOffset()`, comparación con `select public.hoy(), now()`.

## Severidad y prioridad
Flujo principal inutilizable en un navegador soportado = S2/P1. Desborde o texto cortado = S3. Diferencias cosméticas = S4. Incongruencia de fechas por zona horaria = S2/S3.

## Formato de salida
| ID | Escenario | Dispositivo/Navegador/Zona | Resultado | Evidencia | Bug (ID, S/P) |
Después: matriz navegador × flujo y bugs con la plantilla `98`.
