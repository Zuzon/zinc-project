// Stages the Electron app in dist/app: bundled main, preload and DB worker,
// the zinc-web build as renderer/, and the runtime-only package.json and
// node_modules that electron-builder packages.
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
const outDir = join(projectDir, 'dist/app');
const rendererDir = join(projectDir, '../zinc-web/dist');
const require = createRequire(import.meta.url);
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

rmSync(outDir, { recursive: true, force: true });

await build({
  entryPoints: {
    main: join(projectDir, 'src/main.ts'),
    preload: join(projectDir, 'src/preload.ts'),
    'db-worker': join(projectDir, 'src/dbWorker.ts'),
  },
  outdir: outDir,
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  sourcemap: true,
  // Compile workspace libs from source; legacy decorators come from the tsconfig.
  conditions: ['@zinc-project/source'],
  tsconfig: join(projectDir, 'tsconfig.app.json'),
  // The native module ships as a package beside the bundle.
  external: ['electron', 'better-sqlite3'],
  // createDataWorker's default worker URL is unused: main passes db-worker.cjs.
  logOverride: { 'empty-import-meta': 'silent' },
  logLevel: 'info',
});

cpSync(rendererDir, join(outDir, 'renderer'), { recursive: true });
cpSync(join(projectDir, 'build/icon.png'), join(outDir, 'icon.png'));

// better-sqlite3 loads a bundled N-API prebuild for the running platform, so
// one copy serves every Electron target; electron-builder drops the others.
const sqliteDir = dirname(require.resolve('better-sqlite3/package.json'));
const sqlite = readJson(join(sqliteDir, 'package.json'));
const sqliteOut = join(outDir, 'node_modules/better-sqlite3');
mkdirSync(sqliteOut, { recursive: true });
for (const entry of ['package.json', 'LICENSE', 'lib', 'prebuilds']) {
  cpSync(join(sqliteDir, entry), join(sqliteOut, entry), { recursive: true });
}
const pkg = readJson(join(projectDir, 'package.json'));
writeFileSync(
  join(outDir, 'package.json'),
  JSON.stringify(
    {
      name: 'zinc-navigation',
      productName: pkg.productName,
      version: pkg.version,
      description: pkg.description,
      author: pkg.author,
      license: readJson(join(projectDir, '../../package.json')).license,
      main: 'main.cjs',
      // Wayland app_id / WM_CLASS; matches the .desktop file electron-builder writes.
      desktopName: 'zinc-navigation.desktop',
      dependencies: { 'better-sqlite3': sqlite.version },
    },
    null,
    2,
  ) + '\n',
);
// Its only dependency is node-addon-api, which is needed to compile, not to run.
writeFileSync(
  join(sqliteOut, 'package.json'),
  JSON.stringify(
    { ...sqlite, dependencies: {}, devDependencies: {}, scripts: {} },
    null,
    2,
  ) + '\n',
);
