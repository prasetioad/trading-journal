import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Unit tests for the pure logic modules (Roadmap V2 A3) + page render smoke.
// Logic tests run on `node`; component tests opt into jsdom via a
// `// @vitest-environment jsdom` docblock. The React plugin gives `.tsx`
// tests the automatic JSX runtime (same as vite.config.ts).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
