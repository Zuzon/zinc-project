import { MapViewService } from './map/mapView.host.js';
import { IndexedDbKeyValueStore } from './storage/indexedDbKeyValueStore.js';

/** Composition root of the UI-state worker: builds and wires every host service. */
export class WorkerContext {
  readonly mapView: MapViewService;

  constructor() {
    const settings = new IndexedDbKeyValueStore('zinc-ui');
    this.mapView = new MapViewService(settings);
  }
}
