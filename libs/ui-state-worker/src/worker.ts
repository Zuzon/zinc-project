// Web Worker entry: hosts the UI-state services for the main thread.
import { config, interval } from 'rxjs';
import { rxjsBridgeHealthMonitor } from 'rxjs-bridge';
import { WorkerContext } from './lib/workerContext.js';

config.onUnhandledError = (err) => {
  console.error('[ui-state-worker] unhandled rx error', err);
};

new WorkerContext();

interval(60_000).subscribe(() => {
  console.debug(
    '[ui-state-worker] rxjs-bridge health',
    rxjsBridgeHealthMonitor.checkHealth(),
  );
});
