// DB worker entry: owns every SQLite database and hosts the contracts/db services.
import { workerData } from 'node:worker_threads';
import { config, interval } from 'rxjs';
import { rxjsBridgeHealthMonitor } from 'rxjs-bridge';
import type { DataWorkerData } from './lib/dataWorker.js';
import { MapStore } from './lib/maps/mapStore.js';
import { MapStoreHost } from './lib/maps/mapStore.host.js';

config.onUnhandledError = (err) => {
  console.error('[db-worker] unhandled rx error', err);
};

const { mapsDir } = workerData as DataWorkerData;
new MapStoreHost(new MapStore(mapsDir));

interval(60_000).subscribe(() => {
  console.debug(
    '[db-worker] rxjs-bridge health',
    rxjsBridgeHealthMonitor.checkHealth(),
  );
});
