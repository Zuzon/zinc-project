import { defineConfig } from 'vitest/config';

// Named *.e2e.config so neither @nx/vitest nor vitest.workspace.ts picks it up
// as a unit-test project; it runs only through the explicit `e2e` target.
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/zinc-server-e2e',
  test: {
    name: '@zinc-project/zinc-server-e2e',
    watch: false,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    globalSetup: ['src/support/global-setup.ts'],
    setupFiles: ['src/support/test-setup.ts'],
    reporters: ['default'],
    // One server is shared by all spec files.
    fileParallelism: false,
  },
}));
