import { defineConfig } from 'vitest/config';

// WHY: React form and dialog behavior needs a browser-like DOM in unit tests.
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/api/**/*.test.ts', 'src/pages/**/*.test.tsx', 'src/components/**/*.test.tsx'],
    clearMocks: true,
  },
});
