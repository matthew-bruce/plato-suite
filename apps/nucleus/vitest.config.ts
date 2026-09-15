import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Vitest ran with no config at all until now, which is why nothing could test
 * a route handler: `@/...` did not resolve, so importing app/api/**\/route.ts
 * from a test failed at module load. Every export test therefore stopped at
 * the sheet-builder boundary and the route's own wiring — which variant gets
 * which branch, which query parameters it reads, what it does when one is
 * missing — had no coverage. A regression that only existed in that wiring
 * shipped past a green suite because of it.
 *
 * The alias mirrors tsconfig's `paths`, so a test imports a module by exactly
 * the specifier the application code uses. Nothing else is configured: the
 * existing suites resolve by relative path and are unaffected.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
})
