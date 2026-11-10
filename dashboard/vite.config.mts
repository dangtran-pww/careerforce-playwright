// Vite builds the dashboard (dashboard/src) into dashboard/dist, which
// dashboard/server/index.mjs serves. The server runs this build itself on
// start, and with --dev it runs Vite in its own process instead, for live
// reload. See the comment at the top of src/main.tsx.

import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
