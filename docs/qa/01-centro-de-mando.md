# 01 · Prueba funcional: Centro de Mando (`/`)

> Copia todo este archivo como prompt. Prefijo de casos: **CM**.

## Rol y mentalidad
Eres un QA senior escéptico. Tu trabajo es demostrar que lo que muestra el tablero **coincide con los datos reales** de la base y que cada acción (Escalar, Resolver) deja los efectos correctos en la base, la cola de alertas y la auditoría. Contrastas siempre la pantalla con una consulta SQL independiente.

## Contexto técnico
- Página: `web/src/pages/CentroMando.jsx`. Datos: `useItems` (vista `v_item`), `useBloqueantesAbiertos` (`v_bloqueante_abierto`), `useConteoAlertas`, `useCatalogo('cliente')`, `useConfigCorreo`.
- Componentes (`web/src/features/centro/`): `BloqueantesActivos`, `ProximasAlertas` (6 filas), `EstadoItemsDonut`, `AvancePorCliente`, `AtrasadosPorVencer` (máx. 12, ventana de 7 días), `CargaPorResponsable`, `ActividadNotificaciones` (8 filas), `AvisoInicio` (`config.aviso_inicio`).
- Acciones: **Escalar** → Edge Function `alertas` acción `escalar {bloqueante_id}` → `{ok, mensaje}`. **Resolver** → RPC `guardar_item({bloqueado:false}, id)` y luego `alertas/item_guardado`.
- Atraso: calculado en la vista `v_item.atraso_dias` (fecha_compromiso = `plan_pruebas_fin` o `plan_fin`; hora de Bogotá).
- Panel lateral: `components/layout/ResumenLateral.jsx` (ítems abiertos, atrasados, bloqueantes, alertas en cola, estado del correo).

## Archivos a leer antes de probar
`pages/CentroMando.jsx`, `features/centro/*`, `lib/dominio.js`, `lib/fechas.js`, `api/alertas.js` (`contarAlertas`), `supabase/migrations/20261106000002_vistas.sql`, `supabase/functions/alertas/index.ts` (`escalarBloqueo`).

## Datos de prueba
Plan importado (274 ítems) + estos ajustes por SQL en el proyecto de pruebas:
1. Un ítem `En curso` con `plan_fin` ayer y responsable asignado (atrasado).
2. Un ítem `En curso` con `plan_fin` en 3 días (por vencer).
3. Un ítem bloqueado con motivo y otro bloqueado sin atraso (para «con atraso» = 1).
4. 2 alertas pendientes y 1 fallida en `alerta_programada`; 10 filas en `notificacion_log` (3 `Enviada` hoy).
5. Cliente con estado `Pausado` (no debe contar como activo).
6. `config.aviso_inicio = 'Mensaje de prueba'`.

## Escenarios
| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| CM-01 | KPI Clientes | Contar `cliente` con `estado='Activo'` | Valor = conteo; detalle «N ítems en el plan» = filas de `v_item` |
| CM-02 | KPI Avance | `Terminado` / total | Porcentaje redondeado, barra proporcional; detalle «X terminados · Y en pruebas» |
| CM-03 | KPI Atrasados | Abiertos con `atrasado = true` | Coincide con SQL; detalle «de N ítems abiertos» (abiertos = no Terminado ni Suspendido) |
| CM-04 | KPI Bloqueantes | `v_bloqueante_abierto` | Valor = filas; «con atraso» = severidad `Alta` |
| CM-05 | KPI Alertas hoy | `notificacion_log` estado `Enviada` desde las 00:00 | Coincide; detalle «N fallida(s) por revisar» solo si hay `Fallida` en `alerta_programada` |
| CM-06 | Hero | Leer subtítulo | Día de la semana, fecha dd/mm, nº de bloqueantes y de alertas en cola correctos; insignia «Correo en simulación»/«Correo activo» según `smtp_config.dry_run` |
| CM-07 | Aviso de inicio | Con `aviso_inicio` poblado pulsar «Entendido»; recargar | Desaparece y no vuelve (`config.aviso_inicio = ''`); sin aviso no se muestra la tarjeta |
| CM-08 | Escalar con destinatarios | Pulsar «Escalar» en un bloqueo | Toast «Escalamiento enviado.»; nueva fila en `alerta_programada` (`BLOQUEO_ESCALAR`); `bloqueante.escalado_en` actualizado; «Escalado dd/mm hh:mm» aparece tras refrescar |
| CM-09 | Escalar sin destinatarios válidos | Vaciar correos de stakeholders/líder/PO | Toast de aviso «No hay destinatarios con correo válido.»; `notificacion_log` con `Omitida` |
| CM-10 | Resolver | Pulsar «Resolver» | El bloqueo desaparece; `bloqueante.resuelto_en` poblado; nota «Bloqueo resuelto: …» en bitácora; escalamientos pendientes cancelados; alerta `BLOQUEO_RESUELTO` encolada |
| CM-11 | Doble clic | Pulsar «Resolver» dos veces rápido | Una sola resolución; sin error; botones deshabilitados mientras `ocupado` |
| CM-12 | Bloqueo ya resuelto en otra pestaña | Resolver en pestaña A, escalar en pestaña B | Error claro «Ese bloqueo ya no está abierto.» (no un fallo mudo) |
| CM-13 | Próximas alertas | 8 pendientes | Máximo 6, ordenadas por `enviar_en`; día/hora coherentes con la hora local |
| CM-14 | Actividad de notificaciones | 10 filas de log | Últimas 8, orden descendente; chip de estado con tono correcto |
| CM-15 | Sin datos | Tablas vacías | Mensajes de vacío de cada tarjeta; sin errores en consola |
| CM-16 | Donut de estados | Mezcla de estados + bloqueados | Total al centro = nº de ítems; un ítem bloqueado se cuenta como «Bloqueado» (confirmar contra el original); colores por estado |
| CM-17 | Avance por cliente | Cliente sin ítems / sin cliente | Barras apiladas por estado; «Sin cliente» agrupa los nulos |
| CM-18 | Responsivo del gráfico | Reducir a 375 px | Sin desbordes horizontales de la página |
| CM-19 | Atrasados y por vencer | 20 ítems en ventana | 12 visibles + «Y 8 más…»; orden por `fecha_compromiso`; chips «N día(s) de atraso» vs «Por vencer» |
| CM-20 | Terminado en pruebas | Ítem `Terminado, en etapa de pruebas` sin `plan_pruebas_fin` | Comportamiento coherente con el motor de vencimientos (no vence solo con pruebas) |
| CM-21 | Carga por responsable | Ítems sin responsable | Fila «Sin asignar»; barra proporcional al máximo; color ámbar si hay atrasados |
| CM-22 | Cierre de ítems | Cerrar un ítem desde Backlog y volver al tablero | KPIs y listas se actualizan (invalidación de caché) |
| CM-23 | Resumen lateral | Comparar con el tablero | Mismos totales de abiertos, atrasados y bloqueantes; correo «Simulación/Activo/Sin configurar» correcto |
| CM-24 | Zona horaria | Cambiar la zona del sistema a UTC+9 y a UTC-8 | Documentar diferencias en «por vencer», «Alertas hoy» y fechas de alertas (ver H-09, H-23) |
| CM-25 | Límite de filas | Cargar 1 200 ítems (ver prompt 14) | Los KPIs deben reflejar los 1 200; documentar el truncamiento a 1 000 si ocurre (H-03) |

## Puntos sospechosos (leer y confirmar)
- `pages/CentroMando.jsx:21` usa `hoyIso()` (hora local del navegador) para la fecha del Hero; `features/centro/ProximasAlertas.jsx:12` muestra el día UTC con hora local (H-23).
- `features/centro/BloqueantesActivos.jsx:47-64` cubre errores con `try/catch`; `AvisoInicio.jsx:15` no (H-05).
- `api/items.js:5-13` sin paginación (H-03): KPIs erróneos con más de 1 000 ítems.
- El tablero no se refresca solo: depende de `staleTime` (15 s) y de recuperar el foco; confirmar tras un `tick` del cron.
- Escalar por el botón no usa clave única: pulsar varias veces genera varios correos (puede ser deseado; documentar).

## Evidencia a capturar
Captura de cada KPI junto a la consulta SQL que lo valida, pestaña Network de `escalar` y `item_guardado` (estado y cuerpo), filas resultantes en `alerta_programada`, `bloqueante`, `nota` y `auditoria`.

## Severidad y prioridad
Dato incorrecto en un KPI = S2/P1. Acción que no deja efectos o los duplica = S2/P1. Texto o formato = S4.

## Formato de salida
| ID | Escenario | Resultado (PASA/FALLA/BLOQUEADO/N-A) | Evidencia | Bug (ID, S/P) |
Después: lista de bugs con la plantilla `98-plantilla-reporte-de-bug.md` y tres recomendaciones.
