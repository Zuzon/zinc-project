import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import * as path from 'path';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/backend',
  plugins: [
    // Legacy decorators + useDefineForClassFields: false come from the tsconfig.
    swc.vite({
      tsconfigFile: path.join(__dirname, 'tsconfig.lib.json'),
    }),
  ],
  // Resolve workspace libs to their TS sources, not their dist builds.
  resolve: {
    conditions: ['@zinc-project/source', ...defaultServerConditions],
  },
  ssr: {
    resolve: {
      conditions: ['@zinc-project/source', ...defaultServerConditions],
    },
  },
  test: {
    name: '@zinc-project/backend',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
