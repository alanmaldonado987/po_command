# Pruebas del backend SQL

Aplican todas las migraciones de `supabase/migrations` sobre PostgreSQL en memoria (PGlite) y verifican funciones, vistas, triggers, restricciones, semillas y permisos (RLS y ejecución de funciones por rol).

```bash
npm install
npm test
```

- Cada prueba arranca desde una instantánea de la base ya migrada, así que no comparten datos.
- `helpers/baseDeDatos.js` crea los roles `anon`, `authenticated` y `service_role` con los privilegios por defecto de Supabase.
- Las suites están en `*.test.js`, una por área: `guardarItem`, `eliminaciones`, `personas`, `importarPlan`, `vistas`, `auditoria`, `restricciones`, `semillas` y `permisos`.
- La suite completa tarda unos 2 minutos; el paralelismo está limitado a 3 procesos para no agotar memoria.
