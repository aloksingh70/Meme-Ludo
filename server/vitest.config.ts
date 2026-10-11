import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    server: {
      deps: {
        external: ['node:sqlite']
      }
    }
  },
  resolve: {
    alias: { '@ludo/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) }
  }
})
