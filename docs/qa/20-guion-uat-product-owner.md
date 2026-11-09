# 20 · Guion de UAT para el Product Owner

> Copia todo este archivo como prompt (para que un agente guíe la sesión) o úsalo como guion de una sesión de 90–120 minutos con el PO. Prefijo de casos: **UAT**. Entorno: proyecto de pruebas con el plan de ejemplo importado, correo en **simulación** o buzón sandbox.

## Rol y mentalidad
Facilitador de aceptación. No pruebas la técnica sino **si la herramienta sirve para el trabajo real del PO**, con sus datos y su vocabulario (Cliente → Actividad → Módulo → Funcionalidad). Escribes lo que el PO dice en voz alta, mides tiempos y detectas dudas. Cada paso se resuelve con «Cumple / Cumple con observaciones / No cumple».

## Contexto técnico (para el facilitador)
- La app web reemplaza al Plan de Trabajo en Excel y a la versión Streamlit. Rutas: Centro de Mando, Backlog, Cronograma, Demos & Ceremonias, Equipo & Stakeholders, Alertas & Notificaciones, Analítica, IA Asistente, Configuración & Datos.
- Reglas que el PO debe validar: atraso = fecha fin de pruebas (o de desarrollo) vencida y no terminado/suspendido; reprogramar queda en la bitácora; bloquear avisa a responsable, PO y stakeholders del cliente; escalamiento a 48 h; resumen semanal los lunes 07:30; vencimientos diarios por responsable; correo desde el SMTP configurado.
- Límites conocidos: ver `hallazgos-iniciales.md` (por ejemplo, la exportación a Excel no lleva colores; no hay recuperación de contraseña).

## Archivos a leer
`README.md` de la raíz, `docs/qa/00-estrategia-y-plan-de-pruebas.md`, `docs/qa/hallazgos-iniciales.md`.

## Preparación
- Usuario del PO con credenciales entregadas.
- Plan de ejemplo importado; correos reales del equipo **no** configurados (usar `@example.test`).
- Cronómetro y plantilla de observaciones.

## Guion por escenarios de negocio
| ID | Historia del PO | Pasos guiados | Criterio de aceptación |
|---|---|---|---|
| UAT-01 | «Quiero ver cómo va todo al empezar el día» | Entrar al Centro de Mando | En 30 s identifica avance, atrasados, bloqueos y próximas alertas; las cifras le resultan creíbles |
| UAT-02 | «Un cliente pregunta cómo va su proyecto» | Filtrar por cliente en Backlog, Cronograma y Analítica | Obtiene avance, atrasados y fechas; sabe qué responder |
| UAT-03 | «Cargo mi Plan de Trabajo actualizado» | Importar el Excel (con cambios de fecha) | Entiende la vista previa; el resultado coincide con lo esperado; los cambios de fecha quedan como reprogramaciones |
| UAT-04 | «Llega un nuevo requerimiento» | Crear un ítem nuevo (con catálogo nuevo) y duplicarlo para otro alcance | Tarda < 3 minutos; no se confunde con campos |
| UAT-05 | «Una fecha se mueve» | Cambiar fecha de pruebas y revisar bitácora y aviso | Ve la nota automática y entiende a quién se avisa |
| UAT-06 | «Se bloquea una actividad» | Bloquear con motivo; ver destinatarios; escalar desde el Centro de Mando; resolver | Entiende el flujo completo y el texto del correo (vista previa) |
| UAT-07 | «Preparo la demo del cliente» | Crear una ceremonia Demo; ver ítems listos para mostrar; enviar invitación | La lista de ítems es la correcta |
| UAT-08 | «Registro acuerdos de la reunión» | Cargar 3 acuerdos con responsable y fecha | Quedan guardados; sabe cómo se avisa del vencimiento |
| UAT-09 | «Mantengo el directorio» | Agregar un stakeholder, asignar clientes y categorías, desactivar a alguien | Comprende qué recibe cada persona |
| UAT-10 | «Configuro el correo» | Guardar SMTP, probar, enviar prueba (sandbox), activar envío real y volver a simulación | Pasos claros; mensajes de error comprensibles |
| UAT-11 | «Ajusto las alertas» | Cambiar horas, parámetros y destinatarios de 2 reglas | Entiende cada parámetro y su unidad |
| UAT-12 | «Reviso la cola y reintento» | Cancelar un envío y reintentar uno fallido | Entiende estados y vista previa |
| UAT-13 | «Pregunto al asistente» | Usar 4 sugerencias y 2 preguntas propias; ejecutar una acción con botón | Respuestas útiles; confirma que no se envía nada sin pulsar |
| UAT-14 | «Comparto el estado con mi jefe» | Descargar el Plan en Excel y abrirlo | Mismo formato que su archivo original; fechas legibles; notas por tipo |
| UAT-15 | «Respaldo mis datos» | Descargar el respaldo | Entiende qué contiene y cómo se usa |
| UAT-16 | «Reviso qué pasó» | Abrir Auditoría y el historial de notificaciones | Puede reconstruir quién hizo qué y cuándo |
| UAT-17 | «Uso la app desde el celular» | Centro de Mando, Backlog y aprobar un bloqueo en móvil | Usable en pantalla pequeña |
| UAT-18 | «Cierro sesión y vuelvo» | Cerrar sesión, iniciar de nuevo | Sin sorpresas |
| UAT-19 | «Primer uso de otra persona» | Un colega sin capacitación crea un ítem y localiza un bloqueo | Lo logra con ayuda mínima; se anotan tropiezos |
| UAT-20 | Comparación con la versión anterior | Ejecutar 5 tareas habituales con la herramienta anterior (si está disponible) y con la nueva | La web es igual o mejor en tiempo y claridad; se listan funciones que faltan |

## Funcionalidades que el PO debe confirmar explícitamente
| Funcionalidad original | ¿Se mantiene? (Sí/No/Distinta) | Comentario |
|---|---|---|
| Descarga de respaldo `.db` | Distinta (Excel con todas las tablas) | |
| «Reiniciar base» | Eliminada | |
| «Cerrar la aplicación» | Sustituida por «Cerrar sesión» | |
| Edición de catálogos como tabla única | Distinta (fila por fila con confirmación) | |
| Contraseña SMTP en `.env` | Distinta (guardada en la base, no visible) | |
| Exportación Excel con estilos | Parcial (sin colores ni paneles congelados) | |

## Puntos sospechosos (para observar)
- Dudas del PO sobre «Fin planificado» (¿pruebas o desarrollo?) y sobre quién recibe cada alerta (`recibe` vacío = todo).
- Mensajes que sugieren «enviado» estando en simulación (`DetalleCeremonia.jsx:47`).
- Falta de aviso cuando falla una acción (H-05).
- Tiempo de carga con el volumen real del PO (¿cuántos ítems y notas tiene?).

## Evidencia a capturar
Tiempos por tarea, comentarios textuales, capturas de confusiones, lista de funciones faltantes, resultado por escenario.

## Severidad y prioridad
«No cumple» en UAT-01…UAT-08 = bloqueante de aceptación (S2/P1). Observaciones de claridad = S3/S4. Funciones faltantes se registran como solicitudes de cambio.

## Formato de salida
| ID | Historia | Resultado (Cumple / Con observaciones / No cumple) | Tiempo | Observaciones del PO | Acción |
Al final: acta de aceptación con firma del PO, decisión (Aceptado / Aceptado con reservas / Rechazado) y lista de reservas con fecha compromiso.
