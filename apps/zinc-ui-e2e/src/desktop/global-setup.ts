import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { workspaceRoot } from '@nx/devkit';
import type { TestProject } from 'vitest/node';
import '../support/context.js';
import { createSeededData } from '../support/seededData.js';

/** Seeds the data dir; each spec launches the staged Electron app on it. */
export default async function setup(project: TestProject) {
  const electronApp = join(workspaceRoot, 'apps/zinc-electron/dist/app');
  if (!existsSync(join(electronApp, 'main.cjs'))) {
    throw new Error(
      `${electronApp} is not built; run nx build @zinc-project/zinc-electron`,
    );
  }
  // The electron package's main export is the path of its binary.
  const electronPath = createRequire(import.meta.url)('electron') as string;
  const data = await createSeededData();

  project.provide('electronPath', electronPath);
  project.provide('electronApp', electronApp);
  project.provide('dataDir', data.dataDir);

  return () => data.dispose();
}
