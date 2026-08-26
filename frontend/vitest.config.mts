import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Match the app's `@` alias from vite.config.mts.
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // PollingIntegration has a known CopilotKit mocking gap (pre-existing; was excluded in CI).
    exclude: ['src/components/BlogWriter/__tests__/PollingIntegration.test.tsx', 'node_modules/**', 'build/**'],
    // Give slower component tests headroom under parallel load.
    testTimeout: 15000,
    // CSS is stubbed; component tests do not need styles.
    css: false,
  },
});
