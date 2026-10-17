import type { Observable } from 'rxjs';
import { RxjsBridge } from 'rxjs-bridge';
import type { MapViewState } from '@zinc-project/dto';

export const MAP_VIEW_SERVICE = 'map-view';

/** Map camera state owned by the UI-state worker; persisted across restarts. */
export abstract class MapViewServiceBase extends RxjsBridge {
  /** Current view; the first value is the one restored on startup. */
  abstract view$: Observable<MapViewState>;
  /** Reports the view the map currently shows. */
  abstract setView(view: MapViewState): Observable<void>;
}
