import {
  MessagePortHandler,
  type SocketHandler,
  WebSocketHandler,
} from 'rxjs-bridge';
import type { UiStateWorkerInit } from '../workerInit.js';

/** Path the backend hosts its rxjs-bridge WebSocket on. */
export const BACKEND_BRIDGE_PATH = '/rx';

/** Backend WebSocket URL on the same host the app was served from. */
export function backendSocketUrl(
  location: { protocol: string; host: string },
  path = BACKEND_BRIDGE_PATH,
): string {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${location.host}${path}`;
}

/** Backend WebSocket URL: the host's own one if it has one, else the page's origin. */
export function backendUrl(
  init: Pick<UiStateWorkerInit, 'backendUrl'>,
  location: { protocol: string; host: string },
): string {
  return init.backendUrl ?? backendSocketUrl(location);
}

/** Opens the reconnecting socket that every backend bridge stub shares. */
export function createBackendSocket(url: string): WebSocketHandler {
  const socket = new WebSocketHandler(url);
  socket.start();
  return socket;
}

/**
 * Started transport to the backend: the host's port when the init message
 * carries one, else a WebSocket to the host's backend URL, else to the host
 * the app was served from.
 */
export function createBackendHandler(
  init: UiStateWorkerInit,
  location: { protocol: string; host: string },
): SocketHandler {
  if (init.backendPort) {
    const handler = new MessagePortHandler(init.backendPort);
    handler.start();
    return handler;
  }
  return createBackendSocket(backendUrl(init, location));
}
