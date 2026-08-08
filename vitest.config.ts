import { defineConfig } from 'vitest/config';

// Minimal Vitest setup: tests target pure TypeScript logic (no Angular
// TestBed), jsdom provides localStorage for the service specs.
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
  },
});
