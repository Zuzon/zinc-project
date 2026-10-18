import type { MessagePortMain } from 'electron';
import { Observable } from 'rxjs';
import type { PortConnection } from 'rxjs-bridge';

/** Adapts Electron's `MessagePortMain` for `PortHostSocketHandler.connect()`. */
export function portConnection(
  port: MessagePortMain,
  address: string,
): PortConnection {
  return {
    send: (data) => port.postMessage(data),
    message$: new Observable<unknown>((subscriber) => {
      const onMessage = (event: Electron.MessageEvent) =>
        subscriber.next(event.data);
      port.on('message', onMessage);
      return () => port.off('message', onMessage);
    }),
    // Emitted once the renderer's end is gone, e.g. on reload or window close.
    close$: new Observable<void>((subscriber) => {
      const onClose = () => subscriber.next();
      port.on('close', onClose);
      return () => port.off('close', onClose);
    }),
    address,
  };
}
