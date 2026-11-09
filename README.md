# PO Command Center

Aplicación web para controlar las actividades de un Product Owner a partir del Plan de Trabajo.

- **Frontend:** React + JavaScript + Tailwind CSS v3 (Vite) en `web/`.
- **Backend:** Supabase en `supabase/`: PostgreSQL con RLS, funciones RPC con la lógica de negocio, Edge Functions para alertas por correo y Auth.

## Puesta en marcha

1. Crea un proyecto en Supabase y aplica el backend siguiendo [supabase/README.md](supabase/README.md): migraciones, usuario PO, despliegue de funciones y programador de alertas.
2. Configura el frontend:

```bash
cd web
cp .env.example .env   # VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

3. Entra con el usuario PO, ve a **Configuración & Datos → Importar Plan de Trabajo** y sube `data_inicial/plan_de_trabajo.xlsx`.
4. En **Alertas & Notificaciones** configura el SMTP, envía un correo de prueba y activa el envío real.

## Arquitectura

| Capa | Dónde | Responsabilidad |
|---|---|---|
| Datos | `supabase/migrations` | Tablas, vistas con atraso calculado, auditoría por triggers, RLS |
| Lógica | funciones SQL (`guardar_item`, `importar_plan`, …) | Bitácora de reprogramaciones, bloqueantes, importación atómica |
| Alertas | `supabase/functions` | Reglas, cola, envío SMTP, resumen semanal, modelo de lenguaje opcional |
| UI | `web/src` | `components/ui` (sistema de diseño), `features/*`, `pages/*`, `api/*` y `hooks/*` |

## Scripts del frontend

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run lint` | ESLint |
| `npm test` | Pruebas (importador de Excel y motor del asistente) |

## Diferencias frente a la versión Streamlit

- Hay inicio de sesión con Supabase Auth; el botón «Cerrar la aplicación» pasa a «Cerrar sesión».
- La contraseña SMTP se guarda en una tabla sin acceso desde el navegador, no en `.env`.
- Los catálogos se editan fila por fila, con confirmación y conteo de ítems afectados.
- El respaldo exporta todas las tablas a un `.xlsx`; ya no hay archivo `.db`.
- La exportación a Excel conserva anchos, celdas combinadas y formato de fecha, pero no colores ni paneles congelados.
- Se eliminó «Reiniciar la base».
