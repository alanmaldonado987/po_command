# Pruebas end-to-end

Playwright prueba la aplicación completa en Chromium sin necesitar Supabase: todas las llamadas de
`supabase-js` (auth, PostgREST, RPC y Edge Functions) las responde un **backend falso con estado en memoria**.

```bash
npm run test:e2e                              # todo, en escritorio y móvil
npx playwright test e2e/backlog.spec.js       # un módulo
npx playwright test --project=desktop         # solo escritorio
npx playwright show-report                    # informe HTML
```

El servidor de pruebas compila la aplicación con `VITE_SUPABASE_URL=http://127.0.0.1:54321` y una clave falsa y la
sirve en el puerto 5199, por lo que **nunca** usa el `.env` real. Además, cualquier petición hacia `*.supabase.co`
se bloquea y hace fallar la prueba.

## Estructura

| Archivo | Contenido |
|---|---|
| `support/fakeBackend.js` | Interceptor de red: auth, REST, RPC y funciones; inyección de fallos y retardos |
| `support/datosSemilla.js` | Datos de ejemplo (3 clientes, 6 personas, 25 ítems, ceremonias, alertas…) |
| `support/rpc.js` | Réplica en JS de `guardar_item`, `importar_plan`, etc. |
| `support/funciones.js` | Réplica de las Edge Functions `alertas`, `correo` e `ia` |
| `support/vistas.js` | Vistas `v_item`, `v_persona`… con el atraso calculado |
| `support/fixtures.js` | `paginaAutenticada`, `paginaAnonima`, `backend` y ayudantes |
| `*.spec.js` | Un archivo por módulo, más responsive, accesibilidad y errores |
| `HALLAZGOS.md` | Defectos reales detectados |

## Cómo escribir una prueba

```js
test('ejemplo', async ({ paginaAutenticada: page, backend }) => {
  await page.goto('/backlog')
  backend.fallarConsulta('/rpc/guardar_item', { mensaje: 'falla simulada' })
  // ... interactuar con la UI ...
  expect(backend.estado.item).toHaveLength(25) // el estado del servidor falso se puede inspeccionar
})
```

El estado se reinicia en cada prueba. Las fechas de la semilla son relativas a hoy (zona `America/Bogota`).
