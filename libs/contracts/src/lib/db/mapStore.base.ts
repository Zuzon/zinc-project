import type { Observable } from 'rxjs';
import { RxjsBridge } from 'rxjs-bridge';
import type { StoredMap, TileData, ZncConfig } from '@zinc-project/dto';

export const MAP_STORE_SERVICE = 'map-store';

/**
 * Map tile databases owned by the DB worker: one SQLite file per map,
 * holding its configuration and every cached tile.
 */
export abstract class MapStoreServiceBase extends RxjsBridge {
  /** All stored maps in creation order; emits again after every change. */
  abstract maps$: Observable<StoredMap[]>;
  /** Creates a new map database and emits its record. */
  abstract createMap(name: string, config: ZncConfig): Observable<StoredMap>;
  /** Emits the cached tile, or `null` when it is not cached. */
  abstract getTile(
    mapId: string,
    z: number,
    x: number,
    y: number,
  ): Observable<TileData | null>;
  /** Stores or replaces a cached tile. */
  abstract putTile(
    mapId: string,
    z: number,
    x: number,
    y: number,
    tile: TileData,
  ): Observable<void>;
}
