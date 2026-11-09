# 99 · Checklist de aceptación (criterios de salida)

Marcar cada punto con la evidencia (enlace al informe del prompt correspondiente). **No se libera a producción con ningún bloqueante abierto.**

## A. Seguridad (bloqueantes)
- [ ] Las Edge Functions rechazan llamadas con la clave `anon` y sin sesión (AU-15, SE-10…SE-13). *(H-01)*
- [ ] `registrar_auditoria` no es invocable por `anon` ni por `authenticated` (AU-14, HU-04). *(H-02)*
- [ ] Registro público desactivado en el proyecto remoto (AU-19, HU-10). *(H-04)*
- [ ] `anon` no lee ni escribe en ninguna tabla ni vista (AU-11…AU-13).
- [ ] La contraseña SMTP no sale del servidor (SE-09, AL-14) y se decidió dónde guardarla (texto plano vs Vault). *(H-10)*
- [ ] No hay XSS en campos, correos ni vista previa (SE-01…SE-06).
- [ ] CORS de las funciones restringido al origen de la aplicación (SE-20). *(H-19)*
- [ ] Sin `service_role` ni secretos en el bundle (AU-28, SE-16).
- [ ] Cabeceras de seguridad del hosting definidas (SE-18, SE-19).
- [ ] `npm audit` revisado y riesgo de `xlsx` aceptado o mitigado (SE-22). *(H-22)*

## B. Datos e integridad
- [ ] Ningún listado se trunca a 1 000 filas sin aviso (RN-01…RN-05) o existe paginación. *(H-03)*
- [ ] Respaldo y exportaciones contienen todas las filas (CF-06, CF-07, RN-03).
- [ ] La importación es atómica e idempotente (DB-31, DB-32, CF-22) y soporta el volumen esperado (RN-15, RN-16). *(H-08)*
- [ ] Reprogramaciones, bloqueos y `terminado_en` correctos (DB-03…DB-11).
- [ ] Rangos de fechas válidos validados en el servidor (DB-05, DB-06). *(H-17)*
- [ ] Ediciones concurrentes: comportamiento decidido y documentado (DB-18). *(H-12)*
- [ ] Auditoría completa y no falsificable (DB-22…DB-25).

## C. Alertas
- [ ] Cada regla genera su alerta una sola vez, a tiempo y a los destinatarios correctos (MA-03…MA-40).
- [ ] No se acumulan registros «Omitida» en cada ejecución (MA-09, MA-14). *(H-07)*
- [ ] Parámetros de reglas validados (negativos, hora inválida) (AL-20, AL-21, MA-07). *(H-13)*
- [ ] El aviso de bloqueo/reprogramación no se pierde si el navegador falla (MA-32, RS-15). *(H-06)*
- [ ] Reintentos, reserva y reenvíos verificados (MA-41…MA-45). *(H-11)*
- [ ] Cron activo, con secretos y con rastro de errores (MA-46, MA-47, HU-08, HU-09).
- [ ] Zona horaria America/Bogota verificada en fronteras (MA-25, MA-26, RC-17…RC-20). *(H-09, H-23)*
- [ ] `config.app_url` y `config.po_correo` correctos en el entorno (HU-12). *(H-15)*
- [ ] SMTP real probado con envío a buzón sandbox y luego a destinatario real controlado (AL-08, AL-10).

## D. Funcionalidad frente al original
- [ ] Todos los casos P1 de los prompts 01–09 ejecutados y en verde.
- [ ] Matriz de trazabilidad (`00-estrategia-y-plan-de-pruebas.md`) cubierta al 100 % o con exclusiones aprobadas.
- [ ] El PO confirmó las diferencias respecto a la versión anterior (`20-guion-uat-product-owner.md`).

## E. Calidad no funcional
- [ ] Errores visibles en todas las mutaciones (RS-05, lista de H-05). *(H-05)*
- [ ] Rendimiento aceptable con el volumen esperado: LCP, INP y tiempos de importación documentados (RN-06…RN-17).
- [ ] Accesibilidad: filas de tabla operables con teclado, etiquetas de grupo, jerarquía de encabezados, contraste (UX-01…UX-17). *(H-14)*
- [ ] Compatibilidad: Chrome, Edge, Firefox y Safari actuales, móvil (RC-01…RC-16); HTTPS obligatorio para `crypto.randomUUID`. *(H-24)*
- [ ] Iconos y tipografías con alternativa si se bloquean los servicios externos (RC-22, UX-27).
- [ ] La caché se limpia al cerrar sesión (AU-07). *(H-20)*

## F. Operación
- [ ] Humo post-despliegue ejecutado y en verde (`18-humo-y-regresion.md`, A y B).
- [ ] Procedimientos de respaldo, restauración y rotación de credenciales documentados (RS-24, RS-25).
- [ ] Usuarios autorizados listados y proceso de alta/baja definido; recuperación de contraseña definida (AU-32).
- [ ] Monitorización mínima: logs de funciones revisados, alerta si `Fallida` > 0 o si el cron falla.

## G. Cierre
| Concepto | Valor |
|---|---|
| Casos ejecutados / total | |
| Casos P1 en verde | |
| Bugs abiertos S1 / S2 / S3 / S4 | |
| Riesgos aceptados (con responsable y fecha) | |
| Decisión | GO / NO-GO |
| Firma QA / fecha | |
| Firma Product Owner / fecha | |
