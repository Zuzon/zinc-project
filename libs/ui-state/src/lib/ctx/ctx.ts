import { config } from 'rxjs';
import type {
  MapLayersServiceBase,
  MapViewServiceBase,
} from '@zinc-project/contracts';
import { createMapLayersBridge } from './mapLayers.bridge.js';
import { createMapViewBridge } from './mapView.bridge.js';
import {
  type UiStateWorkerOptions,
  createUiStateWorker,
} from './uiStateWorker.js';

/** Services the UI talks to; each one is a single bridge stub to the worker. */
export interface Ctx {
  mapView: MapViewServiceBase;
  mapLayers: MapLayersServiceBase;
}

let ctx: Ctx | undefined;
let workerOptions: UiStateWorkerOptions = {};

/**
 * Sets how the UI-state worker reaches the backend. Shells call it before
 * the first {@link getCtx}, e.g. with the port a native host handed over.
 */
export function configureCtx(options: UiStateWorkerOptions): void {
  if (ctx) {
    throw new Error('configureCtx() must run before the first getCtx()');
  }
  workerOptions = options;
}

/** Lazily starts the UI-state worker and connects the bridges on first use. */
export function getCtx(): Ctx {
  if (!ctx) {
    config.onUnhandledError = (err) => {
      console.error('[ui] unhandled rx error', err);
    };
    const worker = createUiStateWorker(workerOptions);
    ctx = {
      mapView: createMapViewBridge(worker),
      mapLayers: createMapLayersBridge(worker),
    };
  }
  return ctx;
}

/** Replaces the context, e.g. with stubs in tests. */
export function setCtx(value: Ctx): void {
  ctx = value;
}
