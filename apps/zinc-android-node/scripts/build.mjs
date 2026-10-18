// Stages the embedded Node project in the Android app's assets: bundled main
// and DB worker plus better-sqlite3's JavaScript. Its native addon is not
// copied; the APK ships it among its native libraries (see zinc-android's
// scripts/fetch-native.mjs) and the backend loads it via ZINC_SQLITE_BINDING.
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';

const projectDir = join(import.meta.dirname, '..');
const outDir =
  process.env.ZINC_ANDROID_NODE_OUT ??
  join(projectDir, '../zinc-android/android/app/src/main/assets/nodejs');
const require = createRequire(import.meta.url);
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

rmSync(outDir, { recursive: true, force: true });

await build({
  entryPoints: {
    main: join(projectDir, 'src/main.ts'),
    'db-worker': join(projectDir, 'src/dbWorker.ts'),
  },
  outdir: outDir,
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  // digidem/nodejs-mobile v24.
  target: 'node24',
  sourcemap: true,
  // Compile workspace libs from source; legacy decorators come from the tsconfig.
  conditions: ['@zinc-project/source'],
  tsconfig: join(projectDir, 'tsconfig.app.json'),
  external: ['better-sqlite3'],
  // createDataWorker's default worker URL is unused: main passes db-worker.cjs.
  logOverride: { 'empty-import-meta': 'silent' },
  logLevel: 'info',
});

const sqliteDir = dirname(require.resolve('better-sqlite3/package.json'));
const sqlite = readJson(join(sqliteDir, 'package.json'));
const sqliteOut = join(outDir, 'node_modules/better-sqlite3');
mkdirSync(sqliteOut, { recursive: true });
for (const entry of ['LICENSE', 'lib']) {
  cpSync(join(sqliteDir, entry), join(sqliteOut, entry), { recursive: true });
}
// Its only dependency is node-addon-api, which is needed to compile, not to run.
writeFileSync(
  join(sqliteOut, 'package.json'),
  JSON.stringify(
    { ...sqlite, dependencies: {}, devDependencies: {}, scripts: {} },
    null,
    2,
  ) + '\n',
);

const pkg = readJson(join(projectDir, 'package.json'));
writeFileSync(
  join(outDir, 'package.json'),
  JSON.stringify(
    {
      name: 'zinc-android-node',
      version: pkg.version,
      private: true,
      main: 'main.cjs',
      dependencies: { 'better-sqlite3': sqlite.version },
    },
    null,
    2,
  ) + '\n',
);
