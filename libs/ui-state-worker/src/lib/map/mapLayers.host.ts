import { Observable, distinctUntilChanged, map, shareReplay } from 'rxjs';
import { WorkerHost } from 'rxjs-bridge';
import {
  MAP_LAYERS_SERVICE,
  MapLayersServiceBase,
  type MapsServiceBase,
} from '@zinc-project/contracts';
import type { MapInfo } from '@zinc-project/dto';
import { sameMap, selectActiveMap } from './activeMapView.js';

/** Decides which backend maps the main map view renders. */
@WorkerHost(MAP_LAYERS_SERVICE)
export class MapLayersService extends MapLayersServiceBase {
  activeMap$: Observable<MapInfo | null>;

  constructor(maps: Pick<MapsServiceBase, 'maps$'>) {
    super();
    this.activeMap$ = maps.maps$.pipe(
      map(selectActiveMap),
      distinctUntilChanged(sameMap),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }
}
