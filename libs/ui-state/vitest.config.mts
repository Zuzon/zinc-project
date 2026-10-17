import { defaultClientConditions } from 'vite';
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import * as path from 'path';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/ui-state',
  plugins: [
    // Legacy decorators + useDefineForClassFields: false come from the tsconfig.
    swc.vite({
      tsconfigFile: path.join(__dirname, 'tsconfig.lib.json'),
    }),
  ],
  // Resolve workspace libs to their TS sources, not their dist builds.
  resolve: {
    conditions: ['@zinc-project/source', ...defaultClientConditions],
  },
  test: {
    name: '@zinc-project/ui-state',
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
  },
}));
