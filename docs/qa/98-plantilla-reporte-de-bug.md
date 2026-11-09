# 98 · Plantilla de reporte de bug

Copia este bloque por cada defecto. Un bug = una causa; si hay varias, repórtalos por separado. Los títulos siguen el patrón **[Módulo] Qué falla en qué condición**.

```
ID: BUG-<número>
Título: [<Módulo>] <resumen en una línea>
Origen: <ID del caso (p. ej. BL-21) y/o hallazgo (H-xx)>
Entorno: <proyecto Supabase de pruebas · URL de la app · commit/versión · navegador y versión · SO · zona horaria · rol/usuario>
Severidad: S1 | S2 | S3 | S4        Prioridad: P1 | P2 | P3
Tipo: Funcional | Seguridad | Datos | Rendimiento | Accesibilidad | Compatibilidad | Usabilidad | Resiliencia | Documentación
Reproducibilidad: Siempre | Intermitente (n de m) | Una vez

Precondiciones / datos:
  - <datos de prueba, SQL aplicado, configuración>

Pasos para reproducir:
  1. ...
  2. ...
  3. ...

Resultado esperado:
  <qué debía ocurrir y por qué (requisito, regla, original de Streamlit)>

Resultado obtenido:
  <qué ocurrió realmente>

Evidencia:
  - Captura/vídeo: <ruta o enlace>
  - Petición/respuesta (método, URL, estado, cuerpo; sin contraseñas ni tokens): ...
  - Consola del navegador / logs de función: ...
  - Consulta SQL y resultado: ...

Impacto:
  <quién se afecta, qué datos, probabilidad, ¿hay alternativa?>

Causa probable (opcional):
  <archivo:línea o función>

Sugerencia de corrección (opcional):
  <cambio propuesto y prueba de regresión a añadir>

Notas de seguridad (solo si aplica):
  CVSS 3.1 orientativo: <vector y puntaje> · Explotabilidad: <requiere cuenta / solo clave pública> · No publicar el detalle fuera del equipo.

Estado: Nuevo | Confirmado | En corrección | Corregido | Verificado | Rechazado (motivo)
```

## Reglas de calidad del reporte
1. Reproducible por otra persona en menos de 10 minutos.
2. Evidencia sin secretos: ocultar contraseñas, claves y tokens.
3. Resultado esperado con fundamento (requisito, regla o comportamiento original).
4. Severidad por impacto, prioridad por urgencia de negocio; justificar si difieren.
5. Al verificar la corrección, enlazar el caso de regresión (`18-humo-y-regresion.md`, suite crítica).

## Guía rápida de severidad
| Sev. | Ejemplos en esta app |
|---|---|
| S1 | La clave pública permite leer/cambiar la configuración SMTP; alertas a destinatarios equivocados; pérdida de datos al importar; la app no inicia sesión |
| S2 | Un KPI muestra un dato incorrecto; el aviso de bloqueo no sale; importación falla con 274 filas; duplicados de acuerdos |
| S3 | Falta de mensaje de error ante un fallo; contraste insuficiente; validación solo en el cliente |
| S4 | Texto, alineación, color, mejora de redacción |
