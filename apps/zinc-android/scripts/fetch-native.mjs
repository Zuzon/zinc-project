// Fetches the native runtime the APK embeds and places it in the Android
// project: digidem's nodejs-mobile (libnode.so + headers for the JNI host) and
// its better-sqlite3 N-API prebuilds. Downloads are pinned by SHA-256 and
// cached in node_modules/.cache/zinc-android. Needs `unzip` and `tar`.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const NODEJS_MOBILE = {
  url: 'https://github.com/digidem/nodejs-mobile/releases/download/v24.20.0-0/nodejs-mobile-android-24.20.0-0.zip',
  sha256: 'f5ffbaf4f2679fa9180b0758c637c2f8fc8828300f95129badf213a028fb37bb',
};

const SQLITE_BASE =
  'https://github.com/digidem/better-sqlite3-nodejs-mobile/releases/download/13.0.3';

/** Android ABI → better-sqlite3 prebuild; arm64 devices plus the x86_64 emulator. */
const ABIS = {
  'arm64-v8a': {
    url: `${SQLITE_BASE}/better-sqlite3-13.0.3-android-arm64.tar.gz`,
    sha256: '8c1b945bf20207f588bfb329251e5748fe18dc8f0b8937b97a2b687db8bbab30',
  },
  x86_64: {
    url: `${SQLITE_BASE}/better-sqlite3-13.0.3-android-x64.tar.gz`,
    sha256: '02bc592324f788fa7492e3ec0d88aae011e7ab74c99452fbf4c3f2b13fbc782e',
  },
};

const projectDir = join(import.meta.dirname, '..');
const appDir = join(projectDir, 'android/app');
const cacheDir = join(projectDir, '../../node_modules/.cache/zinc-android');
const stamp = join(appDir, 'src/main/jniLibs/.fetched');
const wanted = JSON.stringify({ NODEJS_MOBILE, ABIS });

if (existsSync(stamp) && readFileSync(stamp, 'utf8') === wanted) {
  console.info('[fetch-native] up to date');
  process.exit(0);
}

mkdirSync(cacheDir, { recursive: true });

/** Downloads once into the cache and verifies the pinned digest every time. */
async function download({ url, sha256 }) {
  const file = join(cacheDir, url.slice(url.lastIndexOf('/') + 1));
  if (!existsSync(file)) {
    console.info('[fetch-native] downloading', url);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`${url}: HTTP ${res.status}`);
    }
    writeFileSync(`${file}.part`, Buffer.from(await res.arrayBuffer()));
    renameSync(`${file}.part`, file);
  }
  const actual = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (actual !== sha256) {
    rmSync(file);
    throw new Error(`${file}: SHA-256 ${actual}, expected ${sha256}`);
  }
  return file;
}

function extract(archive, into) {
  rmSync(into, { recursive: true, force: true });
  mkdirSync(into, { recursive: true });
  if (archive.endsWith('.zip')) {
    execFileSync('unzip', ['-q', archive, '-d', into]);
  } else {
    execFileSync('tar', ['-xzf', archive, '-C', into]);
  }
}

const nodeDir = join(cacheDir, 'nodejs-mobile');
extract(await download(NODEJS_MOBILE), nodeDir);

const includeOut = join(appDir, 'libnode/include');
rmSync(includeOut, { recursive: true, force: true });
cpSync(join(nodeDir, 'include'), includeOut, { recursive: true });

const jniLibs = join(appDir, 'src/main/jniLibs');
rmSync(jniLibs, { recursive: true, force: true });
for (const [abi, sqlite] of Object.entries(ABIS)) {
  const out = join(jniLibs, abi);
  mkdirSync(out, { recursive: true });
  cpSync(join(nodeDir, 'bin', abi, 'libnode.so'), join(out, 'libnode.so'));

  const sqliteDir = join(cacheDir, `better-sqlite3-${abi}`);
  extract(await download(sqlite), sqliteDir);
  // A lib….so name makes the APK ship it as a native library.
  cpSync(
    join(sqliteDir, 'better_sqlite3.node'),
    join(out, 'libbetter_sqlite3.so'),
  );
}
writeFileSync(stamp, wanted);
console.info('[fetch-native] placed', Object.keys(ABIS).join(', '));
