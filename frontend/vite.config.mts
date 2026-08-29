import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import svgr from 'vite-plugin-svgr';
import { visualizer } from 'rollup-plugin-visualizer';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  const isAnalyze = mode === 'analyze';

  return {
    // ALwrity env vars are still prefixed with REACT_APP_ from the CRA era.
    envPrefix: 'REACT_APP_',

    plugins: [
      // SWC-based React plugin: much faster than Babel for this codebase.
      react(),
      // Allow importing SVGs as React components.
      svgr({ exportAsDefault: false }),
      // Emit a bundle treemap only when explicitly analyzing (`vite build --mode analyze`).
      ...(isAnalyze
        ? [
            visualizer({
              filename: 'bundle-report.html',
              gzipSize: true,
              brotliSize: true,
              open: false,
            }),
          ]
        : []),
    ],

    // Keep the same public/ behaviour as CRA: files here are served at /.
    publicDir: 'public',

    build: {
      // Match the CRA output directory so vercel.json / deployment scripts keep working.
      outDir: 'build',
      // The backend serves JS/CSS from `build/static` (mounted at `/static` in
      // frontend_serving.py). CRA emitted there; align Vite so the same serving path works.
      assetsDir: 'static',
      // Generate source maps for production (toggle to false if you do not need them).
      sourcemap: isDev,
      // Warn (do not fail) when a chunk exceeds this size after minification.
      chunkSizeWarningLimit: 400,
      // Rollup options to keep chunks reasonably sized.
      rollupOptions: {
        output: {
          manualChunks: (id: string) => {
            // Split heavy vendor libraries. Exact package-name matching avoids the
            // previous prefix bug that pulled `react-joyride`, `react-is`,
            // `react-stripe-js`, etc. into the `vendor-react` chunk.
            if (!id.includes('node_modules')) return;
            const seg = id.split('node_modules').pop()!.split('/').filter(Boolean);
            if (!seg[0]) return;
            const pkg = seg[0].startsWith('@') ? `${seg[0]}/${seg[1]}` : seg[0];
            if (pkg === 'react' || pkg === 'react-dom' || pkg === 'react-router' || pkg === 'react-router-dom' || pkg === 'scheduler') return 'vendor-react';
            if (pkg.startsWith('@mui/') || pkg.startsWith('@emotion/')) return 'vendor-mui';
            if (pkg.startsWith('@clerk/')) return 'vendor-clerk';
            if (pkg === 'recharts' || pkg === 'react-smooth' || pkg.startsWith('d3-')) return 'vendor-charts';
          },
        },
      },
    },

    server: {
      // Match the old CRA dev server port.
      port: 3000,
      // Allow access through tunneling services (ngrok, localto, cloudflared, etc.)
      // so the dev server can be reached via a public URL for external testing.
      // Vite blocks non-localhost hosts by default as a DNS-rebinding safeguard.
      allowedHosts: true,
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
        '@copilotkitnext/react',
        '@dnd-kit/core',
        '@dnd-kit/sortable',
        '@emotion/react',
        '@emotion/styled',
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
        // CopilotKit ships pre-compiled ESM that imports the production runtime,
        // which isn't otherwise discovered in dev (dev JSX uses jsx-dev-runtime).
        'react/jsx-runtime',
        'recharts',
        'zod',
        'zustand',
      ],
      // Serve @wix/* directly: they are heavy ESM packages used only in lazy
      // pages (Wix OAuth / test pages) and are the most likely cause of the
      // dependency optimizer hang. Everything else is pre-bundled so CJS interop
      // (prop-types, style-to-js, react/jsx-runtime, etc.) keeps working.
      exclude: ['@wix/sdk', '@wix/blog'],
    },
  };
});
