import { type Subscription, concatMap, switchMap, take, tap } from 'rxjs';
import type { MapViewServiceBase } from '@zinc-project/contracts';
import type { MapEngine } from './mapEngine.js';

/**
 * Restores the persisted view into the engine once, then reports every
 * camera change back. Only the first `view$` value is applied, so the
 * worker's echo of our own reports never moves the map.
 */
export function syncMapView(
  engine: Pick<MapEngine, 'setView' | 'viewChange$'>,
  mapView: Pick<MapViewServiceBase, 'view$' | 'setView'>,
): Subscription {
  return mapView.view$
    .pipe(
      take(1),
      tap((view) => engine.setView(view)),
      switchMap(() => engine.viewChange$),
      concatMap((view) => mapView.setView(view)),
    )
    .subscribe();
}
