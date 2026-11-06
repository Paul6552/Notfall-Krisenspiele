import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 300_000,
  workers: 1,
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:5199', viewport: { width: 1400, height: 900 }, channel: 'chrome', actionTimeout: 10_000 },
  webServer: process.env.BASE_URL ? undefined : { command: 'npx vite --port 5199 --strictPort', url: 'http://localhost:5199', reuseExistingServer: true },
})
