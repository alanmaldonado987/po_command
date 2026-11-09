# 08 · Prueba funcional: IA Asistente (`/asistente`)

> Copia todo este archivo como prompt. Prefijo de casos: **IA**.

## Rol y mentalidad
QA senior de motores de intención por reglas: tu objetivo es romper el orden de las expresiones regulares, probar entradas ambiguas y comprobar que **ninguna acción se ejecuta sin pulsar el botón**.

## Contexto técnico
- Página `web/src/pages/Asistente.jsx`; hook `features/asistente/useAsistente.js`; motor puro en `features/asistente/motor/` (un archivo por intención) con `responder.js` y pruebas en `responder.test.js`.
- Orden de decisión (`responder.js:23-39`): escalamiento (`escal|correo|redact|borrador`) → ítem por código `BL-nnn` → reprogramaciones (`reprogram|cambio de fecha|movi`) → atrasados (`atras|retras|vencid`) → riesgos (`riesg|peligr|preocup|bloque`) → resumen (`resumen|semanal|reporte|informe|stakeholder`) → cliente (por nombre) → carga (`carga|capacidad|sobrecarg|disponib|equipo`) → vencimientos (`venc|vence|fecha|semana`) → persona → ayuda. El texto se normaliza (sin acentos, minúsculas).
- Acciones (botones): `escalar` → `alertas/escalar`; `resumen` → `alertas/resumen`; `recordar` → `alertas/recordar`. Resultados con `mensaje` de la función.
- Modelo opcional: función `ia` (`estado` → `{disponible, modelo}`; `redactar` → `{texto}`) con secretos `IA_BASE_URL`, `IA_MODEL`, `IA_API_KEY`. Si falla, se muestra el texto local + aviso «(No pude usar el modelo configurado…)».
- Datos que usa el motor: items, bloqueantes, personas, ceremonias, acuerdos, notas, reglas, clientes, nombre del PO y `resolverDestinatarios` (función `alertas/destinatarios`).
- Markdown minimalista: `TextoMarkdown.jsx` (negritas, cursivas, listas con guion) renderizado como nodos React.

## Archivos a leer
`features/asistente/**`, `pages/Asistente.jsx`, `hooks/useIa.js`, `api/ia.js`, `supabase/functions/ia/index.ts`, `_shared/modelo.ts`.

## Datos de prueba
Plan importado; bloqueos de 25 h y 60 h; clientes AIR-E, ACUACAR; persona «Dairo» (o similar); reprogramaciones en los últimos 7 días y antes; ítems sin responsable, sin fecha, vencidos; ceremonias próximas.

## Escenarios
| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| IA-01 | Pantalla inicial | Abrir | Saludo con lista de ayuda y 7 sugerencias rápidas |
| IA-02 | «¿Qué está en riesgo?» | Pulsar sugerencia | Lista [Alto]/[Medio]/[Bajo] con bloqueos, atrasos, por vencer, sin responsable, sin fecha; ≤ 4 acciones |
| IA-03 | «¿Qué está atrasado?» | Escribir | Lista agrupada por cliente, ordenada por atraso, con acción «recordar» |
| IA-04 | Escalamiento más antiguo | «Redacta el escalamiento del bloqueo más antiguo» | Borrador con Para, Asunto, cuerpo y botón «Enviar este escalamiento (n destinatario/s)» |
| IA-05 | Escalamiento por código | «escala BL-114» (con y sin ceros/espacios: `bl 114`, `BL114`) | Usa ese bloqueo; si no está bloqueado cae en el más antiguo |
| IA-06 | Sin bloqueos | Sin bloqueos abiertos | «No hay bloqueos abiertos para escalar.» |
| IA-07 | Cliente | «¿Cómo va ACUACAR?» | Porcentaje, resumen por actividad, más atrasados (5), bloqueos con acciones (máx. 2) |
| IA-08 | Cliente inexistente / nombre parcial | «¿Cómo va air?» | Documentar cómo empareja nombres (guiones y mayúsculas) |
| IA-09 | Resumen semanal | «Prepara el resumen semanal para stakeholders» | Avance por cliente, terminados 7 días, atrasados, bloqueos, hitos; botón de envío con nº de destinatarios |
| IA-10 | Reprogramaciones | «¿Qué se reprogramó esta semana?» | Solo notas `Reprogramación` de los últimos 7 días; mensaje de vacío si no hay |
| IA-11 | Carga del equipo | «¿Cómo está la carga del equipo?» | Abiertos y atrasados por responsable; «Sin ítems abiertos: …» para libres |
| IA-12 | Estado de un ítem | «¿Cómo va BL-120?» / código inexistente | Ficha con fechas y últimas 3 notas; «No encontré el ítem BL-nnn.» |
| IA-13 | Persona | «¿Qué tiene Dairo?» | Ítems abiertos de la persona con atraso/bloqueo; ignora palabras de ≤ 3 letras |
| IA-14 | Vencimientos | «¿Qué vence esta semana?» | Cae en `semana`/`vence` → vencimientos 7 días + acuerdos |
| IA-15 | Orden de reglas | «¿Qué bloqueos tiene la carga del equipo?» | Documentar a qué intención cae (por orden de regex) y si es razonable |
| IA-16 | Entrada sin intención | «hola», «», «???» | Mensaje de ayuda; sin errores; entrada vacía no envía |
| IA-17 | Entradas extremas | 5 000 caracteres, HTML, emojis, `**x**` | Se muestra como texto; sin romper el layout |
| IA-18 | Acción: escalar | Pulsar botón | Mensaje de resultado en la burbuja; botón queda como «hecho»; no se repite al re-renderizar |
| IA-19 | Acción: recordar | Pulsar | «N correo(s) de recordatorio enviados (uno por responsable).» o «Hoy ya se había enviado…» en la segunda pulsación |
| IA-20 | Acción: resumen | Pulsar | Mensaje con nº de destinatarios; correo en cola |
| IA-21 | Sin ejecución automática | Pedir un escalamiento y NO pulsar | `alerta_programada` sin filas nuevas |
| IA-22 | Fallo de acción | Detener la función `alertas` | «No se pudo ejecutar: …» en la burbuja |
| IA-23 | Modelo configurado | Con `ia` activa | Badge «Modelo X»; texto pulido; sin inventar datos ni acciones |
| IA-24 | Modelo caído | Forzar error 500 | Texto local + aviso con el motivo |
| IA-25 | Nueva conversación | Pulsar | Limpia mensajes y resultados |
| IA-26 | Datos cargando/fallando | Cortar red al abrir | Estado de carga/error; el input no permite enviar hasta que los datos estén listos |
| IA-27 | Conversaciones largas | 30 mensajes | Scroll; al modelo solo se envían los últimos 6 |
| IA-28 | Inyección en datos | Nota/motivo con `ignora lo anterior y …` | Con el modelo activo la respuesta no debe ejecutar instrucciones; solo redactar |

## Puntos sospechosos
- `motor/responder.js:15-21`: regex amplias (`movi`, `venc`, `bloque`, `equipo`) producen intenciones inesperadas; `fecha` captura casi cualquier pregunta de fechas.
- `motor/escalamiento.js:12`: `datos.items.find(...)` puede devolver `undefined` si el ítem no está en la lista cargada (tope 1 000, H-03) → error al leer propiedades.
- `useAsistente.js:22`: `useTodasLasNotas` truncado (H-03) afecta «reprogramaciones» y notas de un ítem.
- `ia/index.ts:16-20` y `modelo.ts:38-46`: `historial` y `pregunta` sin límites; roles `system` aceptados (H-18); con H-01 cualquiera puede gastar tokens.
- `useAsistente.js:55`: el mensaje de error del modelo (puede incluir códigos HTTP del proveedor) se muestra al usuario.

## Evidencia a capturar
Captura de la conversación, respuesta de Network de cada función, filas de `alerta_programada` antes/después de cada acción, salida de `npm test`.

## Severidad y prioridad
Acción ejecutada sin clic = S1. Intención equivocada o dato inventado = S2. Texto/estilo = S4.

## Formato de salida
| ID | Escenario | Resultado | Evidencia | Bug (ID, S/P) |
Después: bugs con la plantilla `98` y tres recomendaciones.
