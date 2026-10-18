import { defaultClientConditions, defineConfig } from 'vite';
import swc from 'unplugin-swc';
import * as path from 'path';

// Production UI bundle shared by every shell: zinc-server serves it, Electron loads it.
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/zinc-web',
  plugins: [
    // Legacy decorators + useDefineForClassFields: false come from the tsconfig.
    swc.vite({
      tsconfigFile: path.join(import.meta.dirname, 'tsconfig.app.json'),
    }),
  ],
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
  preview: {
    port: 4300,
    host: 'localhost',
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    sourcemap: true,
    // main.ts awaits the host's backend port before mounting the UI.
    target: 'es2022',
    reportCompressedSize: true,
  },
}));
