import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import svgr from 'vite-plugin-svgr';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';

  return {
    // ALwrity env vars are still prefixed with REACT_APP_ from the CRA era.
    envPrefix: 'REACT_APP_',

    plugins: [
      // SWC-based React plugin: much faster than Babel for this codebase.
      react(),
      // Allow importing SVGs as React components.
      svgr({ exportAsDefault: false }),
    ],

    // Keep the same public/ behaviour as CRA: files here are served at /.
    publicDir: 'public',

    build: {
      // Match the CRA output directory so vercel.json / deployment scripts keep working.
      outDir: 'build',
      // Generate source maps for production (toggle to false if you do not need them).
      sourcemap: isDev,
      // Rollup options to keep chunks reasonably sized.
      rollupOptions: {
        output: {
          manualChunks: (id: string) => {
            // Separate the heavy vendor libraries so a single component change does
            // not invalidate the entire vendor bundle.
            if (!id.includes('node_modules')) return;
            if (['react', 'react-dom', 'react-router-dom'].some((n) => id.includes(`/node_modules/${n}`))) {
              return 'vendor-react';
            }
            if (['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'].some((n) => id.includes(n))) {
              return 'vendor-mui';
            }
            if (id.includes('@clerk/clerk-react')) {
              return 'vendor-clerk';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
          },
        },
      },
    },

    server: {
      // Match the old CRA dev server port.
      port: 3000,
      // Mirror the CRA proxy that sent /api to the backend.
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          // Do not rewrite the path; the backend expects /api/*.
        },
      },
      // Open the browser automatically if BROWSER is set.
      open: process.env.BROWSER !== 'none',
    },

    preview: {
      port: 3000,
    },

    resolve: {
      // Use tsconfig.json paths when they are configured.
      tsconfigPaths: true,
      alias: {
        // Convenience alias for src/ imports. Existing relative imports still work.
        '@': resolve(__dirname, 'src'),
      },
    },

    // Dependencies that are slow to cold-start in dev. Pre-bundling them keeps HMR fast.
    optimizeDeps: {
      include: [
        '@clerk/clerk-react',
        '@copilotkit/react-core',
        '@copilotkit/react-ui',
        '@dnd-kit/core',
        '@dnd-kit/sortable',
        '@emotion/react',
        '@emotion/styled',
        '@mui/icons-material',
        '@mui/material',
        '@tanstack/react-query',
        'axios',
        'framer-motion',
        'html2canvas',
        'marked',
        'react',
        'react-dom',
        'react-joyride',
        'react-router-dom',
        'recharts',
        'zod',
        'zustand',
      ],
      // Some CJS-only packages need explicit handling; add here if dev throws errors.
      exclude: [],
    },
  };
});
