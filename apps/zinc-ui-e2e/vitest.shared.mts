import { defaultServerConditions } from 'vite';
import type { ViteUserConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import * as path from 'path';

const conditions = ['@zinc-project/source', ...defaultServerConditions];

/**
 * Config shared by the web and desktop suites. Their files are named
 * *.e2e.config so neither @nx/vitest nor vitest.workspace.ts picks them up as
 * unit tests; they run only through the e2e targets.
 */
export function e2eConfig(suite: 'web' | 'desktop'): ViteUserConfig {
  return {
    root: import.meta.dirname,
    cacheDir: `../../node_modules/.vite/apps/zinc-ui-e2e-${suite}`,
    plugins: [
      swc.vite({
        tsconfigFile: path.join(import.meta.dirname, 'tsconfig.json'),
      }),
    ],
    // Resolve workspace libs to their TS sources, not their dist builds.
    resolve: { conditions },
    ssr: { resolve: { conditions } },
    test: {
      name: `@zinc-project/zinc-ui-e2e:${suite}`,
      watch: false,
      environment: 'node',
      include: [`src/${suite}/**/*.spec.ts`],
      globalSetup: [`src/${suite}/global-setup.ts`],
      reporters: ['default'],
      // One app (server or Electron) and one seeded data dir per suite.
      fileParallelism: false,
      testTimeout: 60_000,
      hookTimeout: 60_000,
    },
  };
}
