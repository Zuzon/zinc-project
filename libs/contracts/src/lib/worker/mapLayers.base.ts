import type { Observable } from 'rxjs';
import { RxjsBridge } from 'rxjs-bridge';
import type { MapInfo } from '@zinc-project/dto';

export const MAP_LAYERS_SERVICE = 'map-layers';

/** Which maps the main map view renders; decided by the UI-state worker. */
export abstract class MapLayersServiceBase extends RxjsBridge {
  /** Base map to show, or `null` while none is available. */
  abstract activeMap$: Observable<MapInfo | null>;
  /** Whether there is another map to switch to. */
  abstract canCycleMap$: Observable<boolean>;
  /** Switches the base map to the next available one, wrapping around. */
  abstract cycleMap(): Observable<void>;
}
