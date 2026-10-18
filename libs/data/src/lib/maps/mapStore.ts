import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BehaviorSubject, Observable, defer, of, throwError } from 'rxjs';
import type { StoredMap, TileData, ZncConfig } from '@zinc-project/dto';
import { MAP_DB_EXTENSION, MapDb, type SqliteOptions } from './mapDb.js';

/**
 * All map tile databases in one directory, one `<id>.znm` file per map.
 * Runs in the DB worker; the host bridges it to the backend.
 */
export class MapStore {
  readonly maps$: Observable<StoredMap[]>;

  private readonly dbs = new Map<string, MapDb>();
  private readonly _maps$ = new BehaviorSubject<StoredMap[]>([]);

  constructor(
    private readonly mapsDir: string,
    private readonly sqlite: SqliteOptions = {},
  ) {
    mkdirSync(mapsDir, { recursive: true });
    for (const entry of readdirSync(mapsDir)) {
      if (!entry.endsWith(MAP_DB_EXTENSION)) {
        continue;
      }
      try {
        const db = MapDb.open(join(mapsDir, entry), sqlite);
        this.dbs.set(db.map.id, db);
      } catch (err) {
        console.warn(`[map-store] skipping unreadable map ${entry}`, err);
      }
    }
    this.publish();
    this.maps$ = this._maps$.asObservable();
  }

  createMap(name: string, config: ZncConfig): Observable<StoredMap> {
    return defer(() => {
      const id = randomUUID();
      const db = MapDb.create(
        join(this.mapsDir, `${id}${MAP_DB_EXTENSION}`),
        name,
        config,
        Date.now(),
        this.sqlite,
      );
      this.dbs.set(id, db);
      this.publish();
      return of(db.map);
    });
  }

  /** `null` for a tile that is not cached or a map that does not exist. */
  getTile(
    mapId: string,
    z: number,
    x: number,
    y: number,
  ): Observable<TileData | null> {
    return defer(() => of(this.dbs.get(mapId)?.getTile(z, x, y) ?? null));
  }

  putTile(
    mapId: string,
    z: number,
    x: number,
    y: number,
    tile: TileData,
  ): Observable<void> {
    return defer(() => {
      const db = this.dbs.get(mapId);
      if (!db) {
        return throwError(() => new Error(`Unknown map ${mapId}`));
      }
      db.putTile(z, x, y, tile);
      return of(undefined);
    });
  }

  close(): void {
    for (const db of this.dbs.values()) {
      db.close();
    }
    this.dbs.clear();
    this._maps$.complete();
  }

  private publish(): void {
    this._maps$.next(
      [...this.dbs.values()]
        .map((db) => db.map)
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
    );
  }
}
