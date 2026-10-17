import type { Observable } from 'rxjs';
import { RxjsBridge } from 'rxjs-bridge';
import type { MapInfo } from '@zinc-project/dto';

export const MAPS_SERVICE = 'maps';

/**
 * Raster maps served by the backend. Tile images are not part of this
 * contract: each map's `tileUrl` points at the host's tile endpoint.
 */
export abstract class MapsServiceBase extends RxjsBridge {
  /** Maps available for display, in import order. */
  abstract maps$: Observable<MapInfo[]>;
  /**
   * Imports a `.znc` map configuration given as file text. Fails with an
   * error whose `key` is an i18n key when the file is invalid.
   */
  abstract importZnc(fileName: string, content: string): Observable<MapInfo>;
}
