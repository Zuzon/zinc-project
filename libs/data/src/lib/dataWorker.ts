import { Worker } from 'node:worker_threads';

/** Startup data the DB worker receives as `workerData`. */
export interface DataWorkerData {
  /** Directory holding one `.znm` tile database per map. */
  mapsDir: string;
  /** better-sqlite3 addon path where no bundled prebuild fits (Android). */
  sqliteBinding?: string;
}

/**
 * Starts the DB worker thread; it hosts the `contracts/db` services.
 * Hosts that bundle `@zinc-project/data/worker` themselves pass its path as `workerFile`.
 */
export function createDataWorker(
  data: DataWorkerData,
  workerFile: string | URL = new URL('../worker.js', import.meta.url),
): Worker {
  return new Worker(workerFile, {
    name: 'zinc-db',
    workerData: data,
  });
}
