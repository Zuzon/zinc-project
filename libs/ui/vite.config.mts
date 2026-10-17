/// <reference types='vitest' />
import { defaultClientConditions, defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import swc from 'unplugin-swc';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/ui',
  plugins: [
    // Legacy decorators + useDefineForClassFields: false come from the tsconfig.
    swc.vite({
      tsconfigFile: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
  ],
  // Resolve workspace libs to their TS sources, not their dist builds.
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
        tsconfigFile: path.join(import.meta.dirname, 'tsconfig.lib.json'),
      }),
    ],
  },
  // Configuration for building your library.
  // See: https://vite.dev/guide/build.html#library-mode
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      // Could also be a dictionary or array of multiple entry points.
      entry: 'src/index.ts',
      name: '@zinc-project/ui',
      fileName: 'index',
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es' as const],
    },
    rollupOptions: {
      // External packages that should not be bundled into your library.
      external: [],
    },
  },
  test: {
    name: '@zinc-project/ui',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
    server: {
      deps: {
        inline: [/lit/, /@lit\//],
      },
    },
  },
}));
