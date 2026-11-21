import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
import {defineConfig} from 'vite';

/**
 * Function: createViteConfig
 * Purpose: Configure the frontend build, module aliases, and local dev server.
 *
 * Returns:
 *   The Vite configuration used for development and production builds.
 */
function createViteConfig() {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
}

export default defineConfig(createViteConfig);
