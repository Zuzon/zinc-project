import type { Observable } from 'rxjs';
import { WorkerThreadHost } from 'rxjs-bridge';
import {
  MAP_STORE_SERVICE,
  MapStoreServiceBase,
} from '@zinc-project/contracts';
import type { StoredMap, TileData, ZncConfig } from '@zinc-project/dto';
import type { MapStore } from './mapStore.js';

/**
 * Bridges {@link MapStore} to the backend thread. Import this module only
 * from the DB worker entry: the decorator throws outside a worker thread.
 */
@WorkerThreadHost(MAP_STORE_SERVICE)
export class MapStoreHost extends MapStoreServiceBase {
  maps$: Observable<StoredMap[]>;

  constructor(private readonly store: MapStore) {
    super();
    this.maps$ = store.maps$;
  }

  createMap(name: string, config: ZncConfig): Observable<StoredMap> {
    return this.store.createMap(name, config);
  }

  getTile(
    mapId: string,
    z: number,
    x: number,
    y: number,
  ): Observable<TileData | null> {
    return this.store.getTile(mapId, z, x, y);
  }

  putTile(
    mapId: string,
    z: number,
    x: number,
    y: number,
    tile: TileData,
  ): Observable<void> {
    return this.store.putTile(mapId, z, x, y, tile);
  }
}
