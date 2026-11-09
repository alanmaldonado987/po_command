# 00 · Estrategia y plan de pruebas

## 1. Alcance
**Dentro:** las 9 pantallas del frontend (`web/src/pages`), la capa de datos (`web/src/api`, `web/src/hooks`), las migraciones y funciones SQL (`supabase/migrations`), las Edge Functions `alertas`, `correo` e `ia` (`supabase/functions`), el programador `cron.sql`, la importación/exportación de Excel (`web/src/lib/excel`) y el motor del asistente (`web/src/features/asistente/motor`).
**Fuera:** infraestructura de Supabase (disponibilidad de la plataforma), el servidor SMTP del proveedor, la plataforma del modelo de lenguaje, la versión Streamlit (eliminada).

## 2. Riesgos priorizados
| # | Riesgo | Probabilidad | Impacto | Prueba principal |
|---|---|---|---|---|
| R1 | Llamadas anónimas a las Edge Functions (fuga de la contraseña SMTP, correos no autorizados) — H-01 | Alta | Crítico | 10, 11 |
| R2 | Acceso de usuarios no autorizados por registro abierto o políticas `using (true)` — H-04 | Media | Crítico | 10 |
| R3 | Pérdida o truncamiento silencioso de datos (límite de 1000 filas, respaldo incompleto) — H-03 | Media | Alto | 14, 09, 12 |
| R4 | Alertas que no salen, salen duplicadas o llevan datos errados (zonas horarias, claves únicas, cola) | Media | Alto | 13 |
| R5 | Corrupción de datos por ediciones concurrentes o importaciones parciales — H-08, H-12 | Media | Alto | 12, 09 |
| R6 | Errores sin feedback al usuario — H-05 | Alta | Medio | 19, 02, 04, 05, 06 |
| R7 | Divergencia funcional respecto a la versión Streamlit (cálculo de atraso, filtros, textos) | Media | Medio | 01–09, 20 |
| R8 | Accesibilidad/compatibilidad deficiente — H-14 | Media | Medio | 15, 16 |
| R9 | Regresión al desplegar (migraciones, funciones, variables de entorno) | Media | Alto | 18 |

## 3. Tipos de prueba
| Tipo | Cobertura | Prompts | Automatización existente |
|---|---|---|---|
| Funcional por módulo | Cada pantalla y flujo | 01–09 | `responder.test.js`, `excel.test.js` (unitarias) |
| Seguridad | Auth, RLS, XSS, inyección, secretos, CORS | 10, 11 | — |
| Integridad/reglas de negocio | RPC, triggers, auditoría | 12 | PGlite ad hoc (migraciones) |
| Backend de alertas | Reglas, cola, cron | 13 | Deno check (tipos) |
| No funcional | Rendimiento, carga | 14 | — |
| Usabilidad/accesibilidad | WCAG 2.1 AA | 15 | — |
| Compatibilidad | Dispositivos, navegadores, zonas | 16 | — |
| Exploratoria | Charters y tours | 17 | — |
| Humo/regresión | Post-despliegue | 18 | — |
| Resiliencia | Red, errores, recuperación | 19 | — |
| Aceptación | PO | 20 | — |

## 4. Criterios de entrada
- Proyecto Supabase de pruebas con migraciones aplicadas y funciones desplegadas.
- Frontend servido y accesible; `npm run lint`, `npm test` y `npm run build` en verde.
- Usuarios y datos de prueba creados según `README.md`; `smtp_config.dry_run = true`.
- `hallazgos-iniciales.md` revisado por el equipo.

## 5. Criterios de salida
- 100 % de los casos P1 ejecutados; 0 defectos S1 abiertos; 0 defectos S2 sin plan aprobado.
- H-01, H-02 y H-04 confirmados y corregidos (o aceptados por escrito).
- Humo (`18`) en verde en el entorno de destino.
- Checklist `99` firmado por QA y por el Product Owner.

## 6. Entregables
Tabla de casos con resultado por prompt, bugs con la plantilla `98`, informe de cobertura frente a la matriz de trazabilidad y recomendación de salida (go/no-go).

## 7. Matriz de trazabilidad: Streamlit → web
Los casos con prefijo son los IDs que cada prompt debe reportar (CM-01, BL-01…). «Ruta/archivos» indica dónde vive la implementación web.

| Funcionalidad original | Implementación web (ruta · archivos) | Casos |
|---|---|---|
| Centro de Mando: KPIs (Clientes, Avance, Atrasados, Bloqueantes, Alertas hoy) | `/` · `pages/CentroMando.jsx` | CM-01…CM-06 |
| Aviso de inicio con «Entendido» | `features/centro/AvisoInicio.jsx` · `config.aviso_inicio` | CM-07 |
| Bloqueantes activos con Escalar y Resolver | `features/centro/BloqueantesActivos.jsx` · `alertas/escalar`, RPC `guardar_item` | CM-08…CM-12 |
| Próximas alertas (6) y Actividad de notificaciones (8) | `ProximasAlertas.jsx`, `ActividadNotificaciones.jsx` | CM-13…CM-15 |
| Estado de ítems (donut), Avance por cliente | `EstadoItemsDonut.jsx`, `AvancePorCliente.jsx`, `components/charts` | CM-16…CM-18 |
| Atrasados y por vencer (7 días, máx. 12), Carga por responsable | `AtrasadosPorVencer.jsx`, `CargaPorResponsable.jsx` | CM-19…CM-22 |
| Backlog: filtros (texto, producto, cliente, actividad, estado, módulo, responsable, alcance, fase) | `/backlog` · `FiltrosBacklog.jsx`, `useFiltrosBacklog.js` | BL-01…BL-08 |
| Backlog: tabla con selección, conteos y descarga Excel | `TablaBacklog.jsx`, `lib/excel/exportarPlan.js` | BL-09…BL-12 |
| Backlog: formulario (crear/editar/duplicar) y validaciones | `FormularioItem.jsx`, `valoresFormulario.js`, RPC `guardar_item` | BL-13…BL-26 |
| Bitácora, reprogramaciones automáticas y bloqueos | `PanelBitacora.jsx`, tabla `nota`, `bloqueante` | BL-27…BL-33 |
| Destinatarios de bloqueo y eliminación con alertas canceladas | `PanelDestinatarios.jsx`, `PanelAcciones.jsx`, RPC `eliminar_item` | BL-34…BL-38 |
| Cronograma: filtros, KPIs, Gantt planificado/ejecutado, sin fechas | `/cronograma` · `pages/Cronograma.jsx`, `GanttChart.jsx`, `tramos.js` | CR-01…CR-14 |
| Ceremonias: agenda, detalle, invitación, eliminación, ítems para demo | `/ceremonias` · `AgendaCeremonias.jsx`, `DetalleCeremonia.jsx` | CE-01…CE-14 |
| Ceremonias: formulario | `FormularioCeremonia.jsx` | CE-15…CE-20 |
| Acuerdos y compromisos | `EditorAcuerdos.jsx`, `v_acuerdo` | CE-21…CE-28 |
| Equipo: fichas, filtros, carga, editor, eliminación | `/equipo` · `pages/Equipo.jsx`, `EditorPersona.jsx`, RPC `guardar_persona` | EQ-01…EQ-20 |
| Alertas: SMTP (guardar, probar, prueba real, activar/volver) | `/alertas` · `FormularioSmtp.jsx`, `ActivacionEnvio.jsx`, función `correo` | AL-01…AL-14 |
| Alertas: KPIs, revisar ahora, reglas y ajuste | `KpisAlertas.jsx`, `TarjetaRegla.jsx` | AL-15…AL-26 |
| Alertas: cola (cancelar/reintentar/vista previa) e historial | `ColaEnvios.jsx`, `HistorialAlertas.jsx` | AL-27…AL-36 |
| Analítica: filtros, KPIs, gráficos, tabla | `/analitica` · `pages/Analitica.jsx`, `metricas.js` | AN-01…AN-16 |
| IA Asistente: intenciones, acciones, modelo opcional | `/asistente` · `features/asistente`, función `ia` | IA-01…IA-24 |
| Configuración: PO, estado correo, respaldo | `/configuracion` · `TarjetaPo.jsx`, `TarjetaBaseDatos.jsx`, `BotonRespaldo.jsx` | CF-01…CF-07 |
| Catálogos (clientes, actividades, módulos, productos) | `PestanaCatalogos.jsx`, `FilaCatalogo.jsx` | CF-08…CF-18 |
| Importar Plan de Trabajo (Excel) | `PestanaImportar.jsx`, `lib/excel/*`, RPC `importar_plan` | CF-19…CF-34 |
| Exportar (Plan y todas las tablas) y Auditoría | `PestanaExportar.jsx`, `PestanaAuditoria.jsx` | CF-35…CF-40 |
| Barra lateral: resumen y cierre | `components/layout/ResumenLateral.jsx`, `Sidebar.jsx` | CM-23, AU-xx |
| Motor de alertas: 8 reglas, destinatarios, cola, reintentos ×3, cron cada 15 min | `supabase/functions/_shared/*`, `cron.sql` | MA-01…MA-40 |
| Auditoría (crear/editar/eliminar) | triggers `auditar_*`, `v_*` | DB-xx |
| **Nuevo en la web:** autenticación | `/login` · `AuthContext.jsx`, Supabase Auth | AU-01…AU-30 |
| **Eliminado:** «Reiniciar base», botón «Cerrar la aplicación» | — | CF-41, AU-31 (confirmar que no existen) |

## 8. Definición de severidad
- **S1:** pérdida/exposición de datos, falla de seguridad, la app no arranca, alertas que salen a destinatarios equivocados.
- **S2:** un flujo principal falla o produce un dato incorrecto sin alternativa.
- **S3:** funcionalidad secundaria con alternativa o defecto visible sin impacto en datos.
- **S4:** cosmético, texto, mejora.
