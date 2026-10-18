import { connectCapacitorBackend } from './capacitorBackend.js';

/** API a native host's preload exposes (zinc-electron); absent in a plain browser. */
export interface ZincHost {
  /** Asks the host for a backend port; it arrives as a {@link BACKEND_PORT_MESSAGE} window message. */
  connectBackend(): void;
}

declare global {
  interface Window {
    zincHost?: ZincHost;
  }
}

/** Must match the message zinc-electron's preload posts (`apps/zinc-electron/src/preload.ts`). */
export const BACKEND_PORT_MESSAGE = 'zinc:backend-port';

/** How the UI-state worker reaches the backend; see `configureCtx()`. */
export interface HostBackend {
  /** Electron: a port to the main process. */
  backendPort?: MessagePort;
  /** Android: the embedded Node backend's loopback WebSocket. */
  backendUrl?: string;
}

/**
 * Connects to a native host's backend. In a plain browser it resolves to
 * nothing, and the worker reaches the backend on the page's origin.
 */
export async function connectHostBackend(
  win: Window = window,
): Promise<HostBackend> {
  if (win.zincHost) {
    return { backendPort: await electronBackendPort(win, win.zincHost) };
  }
  return { backendUrl: await connectCapacitorBackend() };
}

/** Asks Electron's preload for a backend port. */
function electronBackendPort(
  win: Window,
  host: ZincHost,
): Promise<MessagePort> {
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.source !== win ||
        event.data !== BACKEND_PORT_MESSAGE ||
        !event.ports[0]
      ) {
        return;
      }
      win.removeEventListener('message', onMessage);
      resolve(event.ports[0]);
    };
    win.addEventListener('message', onMessage);
    host.connectBackend();
  });
}
