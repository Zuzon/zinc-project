// Web Worker entry: hosts the UI-state services for the main thread.
import { config, interval } from 'rxjs';
import { rxjsBridgeHealthMonitor } from 'rxjs-bridge';
import { createBackendHandler } from './lib/remote/backendSocket.js';
import { isUiStateWorkerInit } from './lib/workerInit.js';
import { WorkerContext } from './lib/workerContext.js';

config.onUnhandledError = (err) => {
  console.error('[ui-state-worker] unhandled rx error', err);
};

// The UI thread posts the init message before any bridge handshake, so the
// hosts exist by the time the handshake is dispatched.
const onInit = (event: MessageEvent) => {
  if (!isUiStateWorkerInit(event.data)) {
    return;
  }
  self.removeEventListener('message', onInit);
  new WorkerContext({
    backend: createBackendHandler(event.data, self.location),
  });
};
self.addEventListener('message', onInit);

interval(60_000).subscribe(() => {
  console.debug(
    '[ui-state-worker] rxjs-bridge health',
    rxjsBridgeHealthMonitor.checkHealth(),
  );
});
