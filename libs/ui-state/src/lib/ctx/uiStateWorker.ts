import UiStateWorker from '@zinc-project/ui-state-worker/worker?worker';

/** Starts the Web Worker that hosts the UI-state services. */
export function createUiStateWorker(): Worker {
  return new UiStateWorker({ name: 'ui-state' });
}
