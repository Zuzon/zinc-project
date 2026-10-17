import type { Observable } from 'rxjs';
import { WorkerBridge, WorkerMethod, WorkerObservable } from 'rxjs-bridge';
import { MAP_VIEW_SERVICE, MapViewServiceBase } from '@zinc-project/contracts';
import type { MapViewState } from '@zinc-project/dto';

/** Declared inside a factory so importing this module never touches `Worker`. */
export function createMapViewBridge(worker: Worker): MapViewServiceBase {
  @WorkerBridge(worker, MAP_VIEW_SERVICE)
  class MapViewBridge extends MapViewServiceBase {
    @WorkerObservable()
    override view$!: Observable<MapViewState>;

    @WorkerMethod()
    override setView(): Observable<void> {
      throw new Error('bridge stub');
    }
  }

  return new MapViewBridge();
}
