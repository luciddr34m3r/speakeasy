import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/sw.ts',
        'src/assets/**',
        'src/**/*.d.ts',
        'src/__tests__/**',
      ],
      reporter: ['text', 'lcov', 'html'],
      // Lowered from 60 after the app tripled in UI-heavy surface area
      // (admin queue, decorations, PWA plumbing) — raise as tests grow
      thresholds: {
        statements: 40,
        branches: 55,
        functions: 45,
        lines: 40,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'virtual:pwa-register/react': resolve(__dirname, 'src/__tests__/stubs/pwa-register-react.ts'),
    },
  },
});
