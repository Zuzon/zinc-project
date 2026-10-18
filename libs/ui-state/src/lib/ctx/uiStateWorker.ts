import UiStateWorker from '@zinc-project/ui-state-worker/worker?worker';
import {
  UI_STATE_WORKER_INIT,
  type UiStateWorkerInit,
} from '@zinc-project/ui-state-worker/init';

export interface UiStateWorkerOptions {
  /** Backend port from a native host (Electron); without it the worker uses a WebSocket. */
  backendPort?: MessagePort;
  /** Backend WebSocket URL from a native host (Android); defaults to the page's origin. */
  backendUrl?: string;
}

/** Starts the Web Worker that hosts the UI-state services. */
export function createUiStateWorker(
  options: UiStateWorkerOptions = {},
): Worker {
  const worker = new UiStateWorker({ name: 'ui-state' });
  // Must precede every bridge handshake: the worker builds its hosts on it.
  const init: UiStateWorkerInit = {
    type: UI_STATE_WORKER_INIT,
    backendPort: options.backendPort,
    backendUrl: options.backendUrl,
  };
  worker.postMessage(init, options.backendPort ? [options.backendPort] : []);
  return worker;
}
