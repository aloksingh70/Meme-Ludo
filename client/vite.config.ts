import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Use the shared rules engine's TypeScript source directly.
      '@ludo/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url))
    }
  }
})
