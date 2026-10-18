import Database from 'better-sqlite3';
import { basename, extname } from 'node:path';
import type { StoredMap, TileData, ZncConfig } from '@zinc-project/dto';
import { migrateMapDb } from './mapDbMigrations.js';

export const MAP_DB_EXTENSION = '.znm';

/** How the DB worker opens SQLite files. */
export interface SqliteOptions {
  /**
   * The better-sqlite3 addon, for platforms without a bundled prebuild:
   * a `.node` path, or a module loaded by {@link loadSqliteAddon}.
   */
  nativeBinding?: string | object;
}

interface TileRow {
  data: Buffer;
  content_type: string;
}

/** One map's SQLite file: its configuration plus all cached tiles. */
export class MapDb {
  readonly map: StoredMap;

  private readonly selectTile: Database.Statement<[number, number, number]>;
  private readonly upsertTile: Database.Statement<
    [number, number, number, Buffer, string, number]
  >;

  private constructor(private readonly db: Database.Database) {
    this.selectTile = db.prepare(
      'SELECT data, content_type FROM tiles WHERE z = ? AND x = ? AND y = ?',
    );
    this.upsertTile = db.prepare(
      'INSERT OR REPLACE INTO tiles (z, x, y, data, content_type, fetched_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    this.map = this.readMap();
  }

  /** Creates `file`; its name without extension becomes the map id. */
  static create(
    file: string,
    name: string,
    config: ZncConfig,
    createdAt = Date.now(),
    sqlite: SqliteOptions = {},
  ): MapDb {
    const db = openDb(file, false, sqlite);
    try {
      db.transaction(() => {
        const insert = db.prepare(
          'INSERT INTO map_meta (key, value) VALUES (?, ?)',
        );
        insert.run('name', name);
        insert.run('znc', JSON.stringify(config));
        insert.run('created_at', String(createdAt));
      })();
      return new MapDb(db);
    } catch (err) {
      db.close();
      throw err;
    }
  }

  /** Opens an existing map database, upgrading its schema when needed. */
  static open(file: string, sqlite: SqliteOptions = {}): MapDb {
    const db = openDb(file, true, sqlite);
    try {
      return new MapDb(db);
    } catch (err) {
      db.close();
      throw err;
    }
  }

  getTile(z: number, x: number, y: number): TileData | null {
    const row = this.selectTile.get(z, x, y) as TileRow | undefined;
    // Copy into an exactly sized buffer so a structured clone sends only the tile.
    return row
      ? { data: new Uint8Array(row.data), contentType: row.content_type }
      : null;
  }

  putTile(
    z: number,
    x: number,
    y: number,
    tile: TileData,
    fetchedAt = Date.now(),
  ): void {
    const data = Buffer.from(
      tile.data.buffer,
      tile.data.byteOffset,
      tile.data.byteLength,
    );
    this.upsertTile.run(z, x, y, data, tile.contentType, fetchedAt);
  }

  close(): void {
    this.db.close();
  }

  private readMap(): StoredMap {
    const rows = this.db.prepare('SELECT key, value FROM map_meta').all() as {
      key: string;
      value: string;
    }[];
    const meta = new Map(rows.map((r) => [r.key, r.value]));
    const name = meta.get('name');
    const znc = meta.get('znc');
    if (name === undefined || znc === undefined) {
      throw new Error(`Map database ${this.db.name} has no configuration`);
    }
    return {
      id: basename(this.db.name, extname(this.db.name)),
      name,
      config: JSON.parse(znc) as ZncConfig,
      createdAt: Number(meta.get('created_at') ?? 0),
    };
  }
}

/**
 * Loads the better-sqlite3 addon from any file name. Android ships it among
 * the APK's native libraries as `lib….so`, which `nativeBinding` as a path
 * cannot load: better-sqlite3 forces a `.node` extension on it.
 */
export function loadSqliteAddon(file: string): object {
  const addon = { exports: {} };
  process.dlopen(addon, file);
  return addon.exports;
}

function openDb(
  file: string,
  mustExist: boolean,
  { nativeBinding }: SqliteOptions,
): Database.Database {
  const db = new Database(file, {
    fileMustExist: mustExist,
    // better-sqlite3 13 also takes a loaded addon; its typings predate that.
    nativeBinding: nativeBinding as string | undefined,
  });
  try {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    migrateMapDb(db);
    return db;
  } catch (err) {
    db.close();
    throw err;
  }
}
