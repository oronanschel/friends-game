import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works on GitHub Pages or any sub-path.
  base: './',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as never);
