import { defineConfig } from 'vitest/config'

// Unit tests for the pure logic modules (Roadmap V2 A3):
// src/lib/finance.ts, analytics.ts, rules.ts. No DOM needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
