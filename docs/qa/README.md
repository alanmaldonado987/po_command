# Paquete de QA · PO Command Center

Conjunto de **prompts reutilizables** para que un agente de IA (o una persona QA) pruebe la aplicación con mentalidad de QA senior. Cada archivo numerado es **autocontenido**: puede pegarse tal cual en un agente que tenga acceso al repositorio, o entregarse a una persona como guion.

## Qué se está probando
- **Frontend:** `web/` (React + JavaScript + Tailwind v3, Vite). Rutas: `/login`, `/` (Centro de Mando), `/backlog`, `/cronograma`, `/ceremonias`, `/equipo`, `/alertas`, `/analitica`, `/asistente`, `/configuracion`.
- **Backend:** `supabase/` (PostgreSQL + RLS, funciones RPC, vistas, 3 Edge Functions: `alertas`, `correo`, `ia`, y `cron.sql`).
- **Referencia funcional:** la versión Streamlit original (ya eliminada del repo). La matriz de trazabilidad está en `00-estrategia-y-plan-de-pruebas.md`.

## Contenido
| Archivo | Tema | Prefijo de casos |
|---|---|---|
| `00-estrategia-y-plan-de-pruebas.md` | Estrategia, riesgos, criterios y matriz de trazabilidad | — |
| `01-centro-de-mando.md` | Funcional: Centro de Mando | CM |
| `02-backlog.md` | Funcional: Backlog y bitácora | BL |
| `03-cronograma.md` | Funcional: Cronograma/Gantt | CR |
| `04-ceremonias-y-acuerdos.md` | Funcional: Ceremonias y acuerdos | CE |
| `05-equipo-y-stakeholders.md` | Funcional: Equipo | EQ |
| `06-alertas-reglas-y-correo.md` | Funcional: Alertas, reglas, cola y SMTP (UI) | AL |
| `07-analitica.md` | Funcional: Analítica | AN |
| `08-asistente-ia.md` | Funcional: Asistente | IA |
| `09-configuracion-e-importacion-excel.md` | Funcional: Configuración, catálogos, Excel | CF |
| `10-autenticacion-autorizacion-rls.md` | Auth, RLS, tokens, registro | AU |
| `11-seguridad.md` | XSS, inyección, secretos, CORS, abuso | SE |
| `12-integridad-de-datos-y-reglas-de-negocio.md` | Transacciones, concurrencia, borrado lógico, auditoría | DB |
| `13-motor-de-alertas.md` | Edge Functions, tiempos, duplicados, cron | MA |
| `14-rendimiento-y-carga.md` | Volumen, límite de 1000 filas, importación grande | RN |
| `15-usabilidad-y-accesibilidad.md` | WCAG 2.1 AA, teclado, lectores | UX |
| `16-responsive-y-compatibilidad.md` | Móvil/tablet/navegadores/zonas horarias | RC |
| `17-pruebas-exploratorias.md` | Charters, SFDIPOT, tours | EX |
| `18-humo-y-regresion.md` | Humo post-despliegue y regresión | HU |
| `19-resiliencia-y-recuperacion.md` | Red caída, errores, recuperación | RS |
| `20-guion-uat-product-owner.md` | Aceptación del Product Owner | UAT |
| `98-plantilla-reporte-de-bug.md` | Formato de bug | — |
| `99-checklist-de-aceptacion.md` | Criterios de salida | — |
| `hallazgos-iniciales.md` | Problemas detectados leyendo el código | H-xx |

## Entorno de prueba (obligatorio)
1. **Un proyecto Supabase exclusivo de pruebas.** Nunca el de producción.
2. Aplicar `supabase/migrations/*`, desplegar `alertas correo ia` y (opcional) `cron.sql`.
3. Frontend: `cd web && copy .env.example .env` (rellenar URL y clave publicable del proyecto de pruebas) y `npm install && npm run dev` → http://localhost:5173.
4. **Correo:** dejar `smtp_config.dry_run = true` (modo simulación, valor inicial). Para pruebas con envío real usar un buzón sandbox (por ejemplo Mailtrap o Mailpit: host del sandbox, puerto 2525/587, `starttls`). **No usar el SMTP corporativo.**
5. Cambiar de inmediato `config.po_correo` (la migración trae un correo real) y `config.app_url`.
6. Desactivar el registro público en Authentication → Providers → Email y crear los usuarios de prueba a mano.
7. Verificar el valor de **Max rows** (Settings → API) y el `statement_timeout` del rol `authenticated`; los prompts 12 y 14 dependen de ellos.

## Credenciales ficticias
| Uso | Correo | Contraseña |
|---|---|---|
| Usuario PO de prueba | `qa.po@example.test` | `QA-Prueba-2026!` |
| Segundo usuario (concurrencia/aislamiento) | `qa.po2@example.test` | `QA-Prueba-2026!` |
| Persona de equipo con correo | `qa.dev1@example.test` | — |
| Stakeholder | `qa.stk@example.test` | — |
| Líder técnico (rol «Líder técnico») | `qa.lider@example.test` | — |

Crear estos usuarios **solo** en el proyecto de pruebas (Authentication → Users → Add user, con *Auto Confirm User*). El dominio `example.test` no resuelve, lo que evita correos reales.

## Datos semilla
- La migración `20261106000004_semillas.sql` crea: `config` (po_nombre, po_correo, app_url), producto `FieldOps`, fila `smtp_config` (simulación) y las 8 reglas de alerta.
- Cargar el plan real de ejemplo desde `data_inicial/plan_de_trabajo.xlsx` en **Configuración & Datos → Importar Plan de Trabajo**. Resultado esperado: 274 filas (AIR-E 114, AFINIA 65, ELECTROHUILA 59, ACUACAR 36), 152 consideraciones y 3 avisos de lectura.
- Para volumen: usar el generador SQL de `14-rendimiento-y-carga.md`.
- Para tiempos de alertas: modificar `bloqueante.abierto_en`, `ceremonia.fecha_hora`, `acuerdo.fecha_limite` desde el SQL Editor (ejemplos en `13-motor-de-alertas.md`).

## Orden recomendado
1. `18` humo (¿arranca todo?) → 2. `10` auth/RLS → 3. `11` seguridad → 4. `12` integridad → 5. funcionales `01`–`09` → 6. `13` alertas → 7. `14` rendimiento → 8. `19` resiliencia → 9. `15` y `16` accesibilidad/compatibilidad → 10. `17` exploratorias → 11. `20` UAT → 12. `99` checklist y reporte final.
Antes de empezar, leer `hallazgos-iniciales.md` y marcar cada H-xx como **confirmado / no reproducible**.

## Cómo usar un prompt con un agente de IA
1. Abrir el archivo y copiar el bloque completo (todo el contenido es el prompt).
2. Darle al agente acceso de lectura al repositorio y a la URL de la app de pruebas.
3. Pedirle que devuelva la tabla de casos en el formato indicado al final de cada prompt.
4. Consolidar los bugs usando `98-plantilla-reporte-de-bug.md` y la severidad definida en `00`.

## Convenciones
- **Severidad:** S1 bloqueante/seguridad/pérdida de datos · S2 funcionalidad principal rota o dato incorrecto · S3 funcionalidad secundaria o con alternativa · S4 cosmético/mejora.
- **Prioridad:** P1 antes de salir a producción · P2 siguiente iteración · P3 backlog.
- **Resultado del caso:** PASA · FALLA · BLOQUEADO · N/A (con motivo).
