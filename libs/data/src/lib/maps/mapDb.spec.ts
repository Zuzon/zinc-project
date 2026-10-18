import Database from 'better-sqlite3';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ZncConfig } from '@zinc-project/dto';
import { MapDb, loadSqliteAddon } from './mapDb.js';
import { MAP_DB_MIGRATIONS } from './mapDbMigrations.js';

const config: ZncConfig = {
  format: 'png',
  epsg: 'EPSG:3857',
  extent: [0, 0, 256, 256],
  grid: { resolutions: [1], origins: [[0, 256]], tileSizes: [[256, 256]] },
  tileUrl: 'https://tiles.example/{z}/{x}/{y}.png',
  headers: { 'User-Agent': 'test' },
};

/** The prebuild better-sqlite3 loads by itself on this machine. */
function defaultAddonPath(): string {
  const require = createRequire(import.meta.url);
  const packageDir = dirname(require.resolve('better-sqlite3/package.json'));
  const binding = require(join(packageDir, 'lib/binding.js')) as {
    getPrebuildPath(): string | null;
  };
  const path = binding.getPrebuildPath();
  if (!path) {
    throw new Error('no better-sqlite3 prebuild for this platform');
  }
  return path;
}

describe('MapDb', () => {
  let dir: string;
  const open: MapDb[] = [];
  const track = (db: MapDb) => (open.push(db), db);

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'zinc-mapdb-'));
  });

  afterEach(() => {
    open.splice(0).forEach((db) => db.close());
    rmSync(dir, { recursive: true, force: true });
  });

  it('stores the map configuration and takes the id from the file name', () => {
    const file = join(dir, 'abc.znm');
    track(MapDb.create(file, 'Test map', config, 42)).close();
    open.pop();

    const db = track(MapDb.open(file));
    expect(db.map).toEqual({
      id: 'abc',
      name: 'Test map',
      config,
      createdAt: 42,
    });
  });

  it('round-trips tile bytes and returns null on a miss', () => {
    const db = track(MapDb.create(join(dir, 'm.znm'), 'm', config));
    const bytes = new Uint8Array([137, 80, 78, 71, 0, 255]);

    db.putTile(3, -1, 2, { data: bytes, contentType: 'image/png' });

    expect(db.getTile(3, -1, 2)).toEqual({
      data: bytes,
      contentType: 'image/png',
    });
    expect(db.getTile(3, -1, 3)).toBeNull();
  });

  it('stores only the viewed bytes of a sliced array', () => {
    const db = track(MapDb.create(join(dir, 'm.znm'), 'm', config));
    const backing = new Uint8Array([1, 2, 3, 4, 5]);

    db.putTile(0, 0, 0, {
      data: backing.subarray(1, 3),
      contentType: 'image/png',
    });

    expect(db.getTile(0, 0, 0)?.data).toEqual(new Uint8Array([2, 3]));
  });

  it('migrates to the latest schema version', () => {
    const file = join(dir, 'v.znm');
    track(MapDb.create(file, 'v', config));

    const raw = new Database(file, { readonly: true });
    expect(raw.pragma('user_version', { simple: true })).toBe(
      MAP_DB_MIGRATIONS.length,
    );
    raw.close();
  });

  it('refuses to open a file that does not exist', () => {
    expect(() => MapDb.open(join(dir, 'missing.znm'))).toThrow();
  });

  it('loads SQLite from the given native binding', () => {
    expect(() =>
      MapDb.create(join(dir, 'n.znm'), 'n', config, 0, {
        nativeBinding: join(dir, 'missing-addon.node'),
      }),
    ).toThrow(/missing-addon/);
  });

  it('opens SQLite with an addon loaded from any file name', () => {
    const addonFile = join(dir, 'libbetter_sqlite3.so');
    copyFileSync(defaultAddonPath(), addonFile);

    const db = track(
      MapDb.create(join(dir, 's.znm'), 's', config, 0, {
        nativeBinding: loadSqliteAddon(addonFile),
      }),
    );

    expect(db.map.name).toBe('s');
  });
});
