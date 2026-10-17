import { WebSocketHandler } from 'rxjs-bridge';

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

/** Opens the reconnecting socket that every backend bridge stub shares. */
export function createBackendSocket(url: string): WebSocketHandler {
  const socket = new WebSocketHandler(url);
  socket.start();
  return socket;
}
