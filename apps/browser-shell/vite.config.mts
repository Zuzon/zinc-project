import { defaultClientConditions, defineConfig } from 'vite';
import swc from 'unplugin-swc';
import * as path from 'path';

// Development shell: serves the UI with HMR for debugging in a plain browser.
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/browser-shell',
  plugins: [
    // Legacy decorators + useDefineForClassFields: false come from the tsconfig.
    swc.vite({
      tsconfigFile: path.join(import.meta.dirname, 'tsconfig.app.json'),
    }),
  ],
  // Resolve workspace libs to their TS sources so edits hot-reload.
  resolve: {
    conditions: ['@zinc-project/source', ...defaultClientConditions],
  },
  server: {
    port: 4200,
    host: 'localhost',
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    sourcemap: true,
    reportCompressedSize: true,
  },
}));
