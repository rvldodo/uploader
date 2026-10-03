import { defineConfig } from 'vitest/config'

// Unit tests cover the platform-free modules (API client, upload source, helpers).
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
})
