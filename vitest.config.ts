import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Resolve the `@/` alias to the repo root to match tsconfig `paths`,
// so tests can `import ... from '@/lib/...'`.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
})
