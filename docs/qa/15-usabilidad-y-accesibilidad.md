# 15 · Usabilidad y accesibilidad (WCAG 2.1 AA)

> Copia todo este archivo como prompt. Prefijo de casos: **UX**. Herramientas sugeridas: axe DevTools, Lighthouse, WAVE, NVDA (Windows) o VoiceOver (macOS/iOS), TalkBack, modo de contraste alto de Windows, zoom del navegador al 200 % y 400 %.

## Rol y mentalidad
Especialista en accesibilidad y usabilidad. Pruebas con **teclado solo** y con lector de pantalla antes que con ratón. No te limitas al informe automático: la mayoría de los fallos se encuentran a mano. Anotas el criterio WCAG de cada fallo.

## Contexto técnico
- Idioma del documento: `web/index.html` (`lang="es"`), título estático «PO Command Center» en todas las rutas.
- Estructura: `components/layout/AppLayout.jsx` (`aside` + `main`), `Sidebar.jsx` (`nav` con `NavLink`), sin «saltar al contenido». Cada página usa `Hero` (`h1`) y las tarjetas usan `h5` (`components/ui/Card.jsx:15`).
- Componentes con interacción propia: `DataTable.jsx` (filas clicables, casillas `readOnly`), `Popover.jsx` + `MultiSelectField.jsx`, `Tabs.jsx` (`role="tablist"/"tab"` sin `tabpanel` ni flechas), `SegmentedControl.jsx` y `PillsSelect.jsx` (botones con `aria-pressed`), `Toggle.jsx` (`role="switch"`), `Expander.jsx` (`details`), `Modal.jsx` (`role="dialog"`, sin trampa de foco), `ToastContext.jsx` (`Alert role="alert"`), gráficos de recharts y `GanttChart.jsx`.
- Formularios: `components/ui/forms/Field.jsx` envuelve el control en `<label>`; `MultiSelectField`, `SegmentedControl` y `PillsSelect` usan `<span>` como etiqueta.
- Iconos: fuente Material Symbols (`Icon.jsx`, `aria-hidden`), cargada desde Google Fonts.
- Paleta (`tailwind.config.js`): texto `ink-muted #64748B`, `ink-soft #334155`, chips con fondos suaves; tamaños mínimos de 11–12 px en etiquetas.
- Animaciones: `animate-spin`, `animate-fade-in`, `animate-slide-in` (sin `prefers-reduced-motion`).

## Archivos a leer
`components/ui/*`, `components/ui/forms/*`, `components/layout/*`, `components/charts/GanttChart.jsx`, `pages/Login.jsx`, `index.html`, `tailwind.config.js`, `index.css`.

## Datos de prueba
Plan importado; un ítem con bloqueo; ceremonias y acuerdos; usuario con lector de pantalla; ventana de 320 px de ancho.

## Escenarios
| ID | Escenario | Pasos | Resultado esperado (criterio WCAG) |
|---|---|---|---|
| UX-01 | Navegación por teclado global | Tab desde la carga hasta el final de cada página | Todos los controles alcanzables en orden lógico; foco visible siempre (2.1.1, 2.4.3, 2.4.7) |
| UX-02 | Saltar al contenido | Primer Tab | Debe existir «Saltar al contenido» (2.4.1); hoy no |
| UX-03 | Filas clicables | En Backlog, mover el foco a una fila y pulsar Enter/Espacio | Debe poder seleccionar con teclado (2.1.1); hoy `DataTable.jsx:55-60` no lo permite (H-14) |
| UX-04 | Selección múltiple en la cola | Cancelar/Reintentar solo con teclado | Casillas operables (2.1.1) |
| UX-05 | Popover y multiselección | Abrir con teclado, navegar, cerrar con Esc | Abre/cierra con teclado, Esc cierra, foco regresa al disparador, `aria-expanded` presente (2.1.1, 4.1.2) |
| UX-06 | Pestañas | Flechas izquierda/derecha entre pestañas | Patrón de pestañas ARIA completo (`tabpanel`, `aria-controls`, flechas) (4.1.2) |
| UX-07 | Etiquetas de formularios | Lector de pantalla en cada campo | Cada control anuncia nombre y rol; revisar `MultiSelectField`/`SegmentedControl`/`PillsSelect` (grupo sin nombre accesible) (1.3.1, 3.3.2, 4.1.2) |
| UX-08 | Errores de formulario | Enviar vacío | Mensajes con `role="alert"`, asociados al campo o resumen, sin depender del color (3.3.1, 3.3.3) |
| UX-09 | Campos obligatorios | Revisar `*` | El asterisco va en la etiqueta; añadir `required`/`aria-required` (3.3.2) |
| UX-10 | Jerarquía de encabezados | Lista de encabezados (axe/NVDA) | Orden h1→h2→h3 sin saltos; hoy h1→h5 (1.3.1, 2.4.6) |
| UX-11 | Título de página | Cambiar de ruta | Cada ruta con `<title>` distinto (2.4.2); hoy estático |
| UX-12 | Foco al cambiar de ruta y al abrir editores | Navegar con teclado | El foco pasa al contenido nuevo o al editor abierto; anuncio al lector (2.4.3, 4.1.3) |
| UX-13 | Contraste de texto | Medir `ink-muted` sobre blanco y sobre `line-soft`, texto de 11–12 px, chips, placeholder | ≥ 4,5:1 en texto normal; ≥ 3:1 en texto grande y componentes (1.4.3, 1.4.11); registrar los pares que fallan |
| UX-14 | Información solo por color | Estados (chips, barras, Gantt, leyenda del donut) | Siempre hay texto/patrón además del color (1.4.1) |
| UX-15 | Gráficos | Lector de pantalla en donut, barras y Gantt | Alternativa textual o tabla de datos equivalente (1.1.1); el Gantt solo ofrece `title` en la fila (`GanttChart.jsx:81`) |
| UX-16 | Tooltips | Pasar el ratón y tabular | Contenido disponible con foco y persistente (1.4.13) |
| UX-17 | Tablas | Lector en `DataTable` | Cabeceras con `scope`, caption o nombre; orden de lectura correcto (1.3.1) |
| UX-18 | Redimensionado | Zoom 200 % y 400 % (320 px) | Sin pérdida de contenido ni desplazamiento en dos ejes salvo tablas/Gantt (1.4.4, 1.4.10) |
| UX-19 | Espaciado de texto | Aplicar bookmarklet de espaciado | Sin recortes (1.4.12) |
| UX-20 | Orientación | Móvil horizontal y vertical | Ambas funcionan (1.3.4) |
| UX-21 | Tamaño de objetivo táctil | Botones `sm` (32 px) y toggles en móvil | ≥ 24×24 px (2.5.8, WCAG 2.2); ideal 44 px |
| UX-22 | Movimiento reducido | Activar «reducir movimiento» del sistema | Animaciones desactivadas o mínimas (2.3.3) |
| UX-23 | Toasts | Provocar éxito y error con lector | Se anuncian una vez, duran lo suficiente y no roban el foco (4.1.3, 2.2.1) |
| UX-24 | Confirmaciones destructivas | Eliminar ítem/persona/catálogo | Confirmación clara; foco en el botón seguro; Esc cancela |
| UX-25 | Sesión y tiempos | Dejar expirar la sesión | Aviso comprensible, sin perder datos escritos (2.2.1) |
| UX-26 | Idioma de fragmentos | Revisar textos en inglés (p. ej. «Hoy», nombres) | Todo en español; atributos `lang` en fragmentos en otro idioma (3.1.2) |
| UX-27 | Iconos sin fuente | Bloquear `fonts.googleapis.com` | Los botones siguen siendo comprensibles; los iconos no aparecen como texto «space_dashboard…» desbordado (1.4.5, robustez) |
| UX-28 | Modo de contraste alto | Windows Contrast Themes | Controles y bordes visibles |
| UX-29 | Heurísticas de Nielsen | Evaluación heurística (10 heurísticas) por pantalla | Lista de problemas con severidad (visibilidad de estado, prevención de errores, consistencia…) |
| UX-30 | Terminología | Revisar textos y mensajes con el PO | Lenguaje coherente con el Plan de Trabajo (Cliente → Actividad → Módulo → Funcionalidad); sin jerga técnica en errores |
| UX-31 | Estados vacíos y de carga | Provocar cada uno | Mensajes útiles; sin pantallas en blanco (ver prompt 19) |
| UX-32 | Feedback de acciones asíncronas | Botones con `loading` | Se deshabilitan, muestran progreso y evitan doble envío |
| UX-33 | Densidad y legibilidad | Tablas con 14 columnas | Columna de código fija; scroll horizontal con indicio visual |
| UX-34 | Primer uso | Persona nueva intenta crear un ítem y escalar un bloqueo sin ayuda | Tiempo y tropiezos documentados |

## Puntos sospechosos
- `components/ui/DataTable.jsx:55-60,66-70`: `<tr onClick>` sin `tabIndex`/`role`/`onKeyDown`; casilla `readOnly` dentro de la fila (H-14).
- `components/ui/Card.jsx:15`: títulos `h5` bajo un `h1` (salto de niveles).
- `components/ui/forms/MultiSelectField.jsx`, `SegmentedControl.jsx`, `PillsSelect.jsx`: etiqueta en `<span>` no asociada al grupo/botón.
- `components/ui/Popover.jsx`, `MultiSelectField.jsx`: sin Esc, sin `aria-expanded`, sin gestión de foco.
- `components/ui/Tabs.jsx`: roles de pestaña incompletos y sin flechas.
- `components/ui/Modal.jsx`: sin trampa de foco ni retorno de foco (confirmar si se usa).
- `components/charts/GanttChart.jsx:37-47,81`: barras sin texto alternativo; detalle solo en `title`.
- `index.html`: título único y fuente de iconos externa (UX-27).
- `index.css`/`tailwind.config.js`: sin `prefers-reduced-motion`.
- `ToastContext.jsx:25-31`: contenedor de avisos sin región `aria-live` explícita (cada `Alert` usa `role="alert"`).

## Evidencia a capturar
Capturas con el criterio WCAG, informes de axe/Lighthouse (JSON), grabación de pantalla con el lector, tabla de contraste (par de colores, valor, resultado), lista de encabezados.

## Severidad y prioridad
Flujo principal no operable con teclado o con lector = S2/P1 (impide el uso a personas con discapacidad). Contraste y etiquetas = S3/P2. Mejoras de uso = S4.

## Formato de salida
| ID | Escenario | Criterio WCAG | Resultado (PASA/FALLA) | Evidencia | Bug (ID, S/P) |
Después: bugs con la plantilla `98` y un plan de remediación ordenado por impacto.
