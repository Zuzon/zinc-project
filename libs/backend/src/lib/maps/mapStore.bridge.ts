import type { Worker } from 'node:worker_threads';
import type { Observable } from 'rxjs';
import {
  WorkerThreadBridge,
  WorkerThreadMethod,
  WorkerThreadObservable,
} from 'rxjs-bridge';
import {
  MAP_STORE_SERVICE,
  MapStoreServiceBase,
} from '@zinc-project/contracts';
import type { StoredMap, TileData } from '@zinc-project/dto';

/** Connects to the map store hosted by the DB worker; create it once per worker. */
export function createMapStoreBridge(worker: Worker): MapStoreServiceBase {
  @WorkerThreadBridge(worker, MAP_STORE_SERVICE)
  class MapStoreBridge extends MapStoreServiceBase {
    @WorkerThreadObservable()
    override maps$!: Observable<StoredMap[]>;

    @WorkerThreadMethod()
    override createMap(): Observable<StoredMap> {
      throw new Error('bridge stub');
    }

    @WorkerThreadMethod()
    override getTile(): Observable<TileData | null> {
      throw new Error('bridge stub');
    }

    @WorkerThreadMethod()
    override putTile(): Observable<void> {
      throw new Error('bridge stub');
    }
  }

  return new MapStoreBridge();
}
