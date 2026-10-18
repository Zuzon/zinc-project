import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import * as path from 'path';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/zinc-android-node',
  plugins: [
    // Legacy decorators + useDefineForClassFields: false come from the tsconfig.
    swc.vite({
      tsconfigFile: path.join(__dirname, 'tsconfig.spec.json'),
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
    name: '@zinc-project/zinc-android-node',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
