import type { Observable } from 'rxjs';
import { WorkerBridge, WorkerMethod, WorkerObservable } from 'rxjs-bridge';
import {
  MAP_LAYERS_SERVICE,
  MapLayersServiceBase,
} from '@zinc-project/contracts';
import type { MapInfo } from '@zinc-project/dto';

/** Declared inside a factory so importing this module never touches `Worker`. */
export function createMapLayersBridge(worker: Worker): MapLayersServiceBase {
  @WorkerBridge(worker, MAP_LAYERS_SERVICE)
  class MapLayersBridge extends MapLayersServiceBase {
    @WorkerObservable()
    override activeMap$!: Observable<MapInfo | null>;

    @WorkerObservable()
    override canCycleMap$!: Observable<boolean>;

    @WorkerMethod()
    override cycleMap(): Observable<void> {
      throw new Error('bridge stub');
    }
  }

  return new MapLayersBridge();
}
