import { Worker } from 'node:worker_threads';

/** Startup data the DB worker receives as `workerData`. */
export interface DataWorkerData {
  /** Directory holding one `.znm` tile database per map. */
  mapsDir: string;
}

/** Starts the DB worker thread; it hosts the `contracts/db` services. */
export function createDataWorker(data: DataWorkerData): Worker {
  return new Worker(new URL('../worker.js', import.meta.url), {
    name: 'zinc-db',
    workerData: data,
  });
}
