import type { SocketHandler } from 'rxjs-bridge';
import type { MapsServiceBase } from '@zinc-project/contracts';
import { MapLayersService } from './map/mapLayers.host.js';
import { MapViewService } from './map/mapView.host.js';
import { createMapsBridge } from './remote/maps.bridge.js';
import { IndexedDbKeyValueStore } from './storage/indexedDbKeyValueStore.js';

export interface WorkerContextOptions {
  /** Started transport to the backend's rxjs-bridge host. */
  backend: SocketHandler;
}

/** Composition root of the UI-state worker: builds and wires every host service. */
export class WorkerContext {
  readonly mapView: MapViewService;
  readonly maps: MapsServiceBase;
  readonly mapLayers: MapLayersService;

  constructor(options: WorkerContextOptions) {
    const settings = new IndexedDbKeyValueStore('zinc-ui');
    this.mapView = new MapViewService(settings);

    this.maps = createMapsBridge(options.backend);
    this.mapLayers = new MapLayersService(this.maps);
  }
}
