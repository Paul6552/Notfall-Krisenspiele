import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base './' + Hash-Routing: die Seite läuft auf jedem statischen Hosting, auch in Unterordnern.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
})
