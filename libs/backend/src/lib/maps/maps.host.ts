import type { Observable } from 'rxjs';
import type { WorkerThreadHost } from 'rxjs-bridge';
import { MapsServiceBase } from '@zinc-project/contracts';
import type { MapInfo } from '@zinc-project/dto';

/** Any rxjs-bridge host decorator, e.g. `WebSocketHost(MAPS_SERVICE, sh)`. */
export type ServiceHostDecorator = ReturnType<typeof WorkerThreadHost>;

/**
 * Exposes `impl` over the transport `host` decorates. The bridge handshake
 * only sees a class's own members, so this declares each one and delegates.
 */
export function hostMapsService(
  host: ServiceHostDecorator,
  impl: MapsServiceBase,
): MapsServiceBase {
  @host
  class MapsHost extends MapsServiceBase {
    maps$: Observable<MapInfo[]>;

    constructor() {
      super();
      this.maps$ = impl.maps$;
    }

    importZnc(fileName: string, content: string): Observable<MapInfo> {
      return impl.importZnc(fileName, content);
    }
  }

  return new MapsHost();
}
