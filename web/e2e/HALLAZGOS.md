# Hallazgos de las pruebas end-to-end

Cada hallazgo tiene una prueba asociada. Las marcadas con `test.fail` pasan mientras el defecto exista y
**empezarán a fallar cuando se corrija**: en ese momento hay que quitar el `test.fail` para que queden como
pruebas de regresión normales.

| ID | Severidad | Estado | Prueba |
|----|-----------|--------|--------|
| H-01 | Alta | Corregido en el código fuente | `ceremonias.spec.js` › regresión H-01 |
| H-02 | Media | Abierto | `accesibilidad.spec.js` › filas de la tabla del backlog con el teclado |
| H-03 | Baja | Abierto | `accesibilidad.spec.js` › Escape cierra el selector múltiple |
| H-04 | Media | Abierto | `accesibilidad.spec.js` › casillas de selección de la cola |
| H-05 | Alta | Abierto | `errores.spec.js` › sin conexión, abrir una página aún no descargada |
| H-06 | Baja | Abierto | `fallos-servidor.spec.js` › descartar el aviso de inicio |
| H-07 | Baja | Abierto | `fallos-servidor.spec.js` › eliminar una nota de la bitácora |

## H-01 · Duración de ceremonia inválida por defecto (corregido)

- **Dónde:** `src/features/ceremonias/FormularioCeremonia.jsx`, campo «Duración (min)».
- **Causa:** el campo usaba `min={5}` y `step={15}`. Para el navegador los valores válidos eran 5, 20, 35, 50, 65…
  y el valor por defecto (60) no lo era, por lo que la validación nativa bloqueaba el envío del formulario sin
  mostrar el mensaje propio de la app.
- **Pasos:** Ceremonias → Agendar → escribir un título → Guardar. No ocurría nada.
- **Estado:** el código fuente ya usa `step={5}`. Las pruebas de regresión quedaron activas.

## H-02 · La tabla del backlog no se puede usar con teclado

- **Dónde:** `src/components/ui/DataTable.jsx`.
- **Causa:** las filas seleccionables (`<tr onClick>`) no tienen `tabIndex`, rol ni manejador de teclado.
- **Impacto:** una persona que navega con teclado o lector de pantalla no puede abrir un ítem del backlog ni
  seleccionar alertas en la cola.
- **Pasos:** Backlog → enfocar una fila con Tab → pulsar Enter. No se abre el editor.
- **Sugerencia:** hacer la fila enfocable (`tabIndex={0}`) y responder a Enter/Espacio, o renderizar un botón en
  la primera celda.

## H-03 · Escape no cierra el selector múltiple

- **Dónde:** `src/components/ui/Popover.jsx` (usado por `MultiSelectField`).
- **Causa:** solo se cierra al pulsar fuera; no escucha la tecla Escape.
- **Pasos:** abrir cualquier filtro «Cliente», «Estado»… y pulsar Escape. Sigue abierto.

## H-04 · Casillas de selección de filas sin nombre accesible

- **Dónde:** `src/components/ui/DataTable.jsx`, modo `multiple`.
- **Causa:** el `<input type="checkbox" readOnly>` de cada fila no tiene `aria-label`.
- **Impacto:** los lectores de pantalla anuncian «casilla de verificación» sin indicar a qué fila corresponde.

## H-05 · Pantalla en blanco si falla la carga de una ruta

- **Dónde:** `src/App.jsx` y `src/components/layout/AppLayout.jsx` (no existe ningún `ErrorBoundary`).
- **Causa:** las páginas se cargan con `React.lazy`. Si la descarga del módulo falla (sin conexión, despliegue
  nuevo que invalidó los archivos antiguos), la promesa se rechaza y React desmonta toda la aplicación.
- **Pasos:** abrir el Centro de Mando, cortar la red y entrar a una página que aún no se había abierto.
  `#root` queda vacío, sin mensaje ni forma de reintentar.
- **Sugerencia:** envolver el `Suspense` en un `ErrorBoundary` con un mensaje y un botón «Reintentar».

## H-06 y H-07 · Fallos silenciosos al guardar

- **Dónde:** `src/features/centro/AvisoInicio.jsx` (botón «Entendido») y
  `src/features/backlog/PanelBitacora.jsx` (botón «Eliminar nota»).
- **Causa:** usan `mutate()` sin `onError`. Si el servidor responde con error, el usuario no ve ningún mensaje.
- **Sugerencia:** usar el mismo patrón del resto de la app (`try/catch` con `useToast()`).

## Observaciones menores (sin prueba que falle)

- `Field` mete el texto de ayuda dentro del `<label>`, así que el nombre accesible de «Rol» y de la contraseña
  SMTP incluye la ayuda completa. Es preferible `aria-describedby`.
- Una hora de envío inválida en «Ajustar regla» se reemplaza en silencio por 08:00 (comportamiento heredado de la
  versión Streamlit). La prueba lo documenta.

## Estado actual

H-01 a H-07 quedaron corregidos y sus pruebas ya no usan `test.fail`; la suite completa pasa en verde.
