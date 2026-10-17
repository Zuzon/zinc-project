import type { Database } from 'better-sqlite3';

/**
 * Schema of a map tile database (`.znm`). Entry `i` upgrades
 * `user_version` `i` to `i + 1`; never edit a released entry, append one.
 */
export const MAP_DB_MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE map_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE tiles (
    z INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    data BLOB NOT NULL,
    content_type TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    PRIMARY KEY (z, x, y)
  ) WITHOUT ROWID;
  `,
];

/** Brings `db` to the latest schema version inside one transaction. */
export function migrateMapDb(db: Database): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  if (current > MAP_DB_MIGRATIONS.length) {
    throw new Error(
      `Map database version ${current} is newer than supported ${MAP_DB_MIGRATIONS.length}`,
    );
  }
  db.transaction(() => {
    for (let v = current; v < MAP_DB_MIGRATIONS.length; v++) {
      db.exec(MAP_DB_MIGRATIONS[v]);
    }
    db.pragma(`user_version = ${MAP_DB_MIGRATIONS.length}`);
  })();
}
