import type { Observable } from 'rxjs';
import {
  SocketHandler,
  SocketMethod,
  SocketObservable,
  WebSocketBridge,
} from 'rxjs-bridge';
import { MAPS_SERVICE, MapsServiceBase } from '@zinc-project/contracts';
import type { MapInfo } from '@zinc-project/dto';

/** Client of the backend maps service; create it once per socket. */
export function createMapsBridge(socket: SocketHandler): MapsServiceBase {
  @WebSocketBridge(socket, MAPS_SERVICE)
  class MapsBridge extends MapsServiceBase {
    @SocketObservable()
    override maps$!: Observable<MapInfo[]>;

    @SocketMethod()
    override importZnc(): Observable<MapInfo> {
      throw new Error('bridge stub');
    }
  }

  return new MapsBridge();
}
