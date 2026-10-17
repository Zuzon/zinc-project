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
    alias: {
      worker_threads: path.join(
        import.meta.dirname,
        '../../tools/vite/worker-threads-stub.js',
      ),
    },
  },
  // The UI-state worker is bundled from ui-state-worker sources and needs
  // the same legacy-decorator transform.
  worker: {
    format: 'es' as const,
    plugins: () => [
      swc.vite({
        tsconfigFile: path.join(import.meta.dirname, 'tsconfig.app.json'),
      }),
    ],
  },
  server: {
    port: 4200,
    host: 'localhost',
    // Backend from `npm run server`: tile endpoint and rxjs-bridge WebSocket.
    proxy: {
      '/api': 'http://localhost:3000',
      '/rx': { target: 'ws://localhost:3000', ws: true },
    },
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
