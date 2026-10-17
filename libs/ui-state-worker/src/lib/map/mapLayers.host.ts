import {
  BehaviorSubject,
  Observable,
  combineLatest,
  distinctUntilChanged,
  map,
  shareReplay,
  take,
} from 'rxjs';
import { WorkerHost } from 'rxjs-bridge';
import {
  MAP_LAYERS_SERVICE,
  MapLayersServiceBase,
  type MapsServiceBase,
} from '@zinc-project/contracts';
import type { MapInfo } from '@zinc-project/dto';
import { nextMap, sameMap, selectActiveMap } from './activeMapView.js';

/** Decides which backend maps the main map view renders. */
@WorkerHost(MAP_LAYERS_SERVICE)
export class MapLayersService extends MapLayersServiceBase {
  activeMap$: Observable<MapInfo | null>;
  canCycleMap$: Observable<boolean>;

  private readonly maps$: Observable<MapInfo[]>;
  private readonly _selectedId$ = new BehaviorSubject<string | null>(null);

  constructor(maps: Pick<MapsServiceBase, 'maps$'>) {
    super();
    this.maps$ = maps.maps$.pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.activeMap$ = combineLatest([this.maps$, this._selectedId$]).pipe(
      map(([list, selectedId]) => selectActiveMap(list, selectedId)),
      distinctUntilChanged(sameMap),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.canCycleMap$ = this.maps$.pipe(
      map((list) => list.length > 1),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  cycleMap(): Observable<void> {
    return combineLatest([this.maps$, this.activeMap$]).pipe(
      take(1),
      map(([list, active]) => {
        const next = nextMap(list, active?.id ?? null);
        if (next) {
          this._selectedId$.next(next.id);
        }
      }),
    );
  }
}
