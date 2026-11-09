import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['*.test.js'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    pool: 'forks',
    poolOptions: { forks: { minForks: 1, maxForks: 3, execArgv: ['--max-old-space-size=4096'] } },
  },
})
