import type { Subscription } from 'rxjs';
import type { MapLayersServiceBase } from '@zinc-project/contracts';
import type { MapEngine } from './mapEngine.js';

/** Shows the map the worker picks as the engine's base layer. */
export function syncMapLayers(
  engine: Pick<MapEngine, 'setBaseMap'>,
  mapLayers: Pick<MapLayersServiceBase, 'activeMap$'>,
): Subscription {
  return mapLayers.activeMap$.subscribe((info) => engine.setBaseMap(info));
}
