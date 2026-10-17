import { config } from 'rxjs';
import type {
  MapLayersServiceBase,
  MapViewServiceBase,
} from '@zinc-project/contracts';
import { createMapLayersBridge } from './mapLayers.bridge.js';
import { createMapViewBridge } from './mapView.bridge.js';
import { createUiStateWorker } from './uiStateWorker.js';

/** Services the UI talks to; each one is a single bridge stub to the worker. */
export interface Ctx {
  mapView: MapViewServiceBase;
  mapLayers: MapLayersServiceBase;
}

let ctx: Ctx | undefined;

/** Lazily starts the UI-state worker and connects the bridges on first use. */
export function getCtx(): Ctx {
  if (!ctx) {
    config.onUnhandledError = (err) => {
      console.error('[ui] unhandled rx error', err);
    };
    const worker = createUiStateWorker();
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
