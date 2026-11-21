import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function noCacheShellMiddleware(): Plugin {
  const applyMiddleware = (
    middlewares: {
      use: (
        fn: (
          req: { url?: string },
          res: {
            statusCode: number;
            setHeader: (name: string, value: string) => void;
            end: (body?: string) => void;
          },
          next: () => void
        ) => void
      ) => void;
    }
  ) => {
    middlewares.use((req, res, next) => {
      const cleanUrl = (req.url || '/').split('?')[0];

      if (cleanUrl === '/manifest.webmanifest' || cleanUrl === '/manifest.json') {
        res.statusCode = 410;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.end('{}');
        return;
      }

      if (
        cleanUrl === '/' ||
        cleanUrl === '/index.html' ||
        cleanUrl === '/sw.js' ||
        cleanUrl === '/dev-sw.js'
      ) {
        res.setHeader(
          'Cache-Control',
          'no-store, no-cache, must-revalidate, proxy-revalidate'
        );
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }

      next();
    });
  };

  return {
    name: 'no-cache-shell-and-pwa-cleanup',
    configureServer(server) {
      applyMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      applyMiddleware(server.middlewares);
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react(), tailwindcss(), noCacheShellMiddleware()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    hmr: process.env.DISABLE_HMR !== 'true',
    // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
