import { defineConfig, devices } from '@playwright/test'

const PUERTO = 5199
export const URL_API_FALSA = 'http://127.0.0.1:54321'
export const CLAVE_ANON_FALSA = 'anon-key-solo-para-pruebas'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'movil', use: { ...devices['Pixel 5'] }, testMatch: ['**/responsive.spec.js', '**/login.spec.js'] },
  ],
  webServer: {
    command: `npx vite build --outDir .e2e-dist --emptyOutDir && npx vite preview --outDir .e2e-dist --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: URL_API_FALSA,
      VITE_SUPABASE_ANON_KEY: CLAVE_ANON_FALSA,
    },
  },
})
