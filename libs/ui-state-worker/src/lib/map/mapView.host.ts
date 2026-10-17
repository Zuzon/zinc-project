import {
  BehaviorSubject,
  EMPTY,
  Observable,
  ReplaySubject,
  type SchedulerLike,
  asyncScheduler,
  catchError,
  concatMap,
  defaultIfEmpty,
  defer,
  distinctUntilChanged,
  filter,
  map,
  of,
  sampleTime,
  shareReplay,
  take,
  takeUntil,
  tap,
  throwError,
} from 'rxjs';
import { WorkerHost } from 'rxjs-bridge';
import { MAP_VIEW_SERVICE, MapViewServiceBase } from '@zinc-project/contracts';
import type { MapViewState } from '@zinc-project/dto';
import type { KeyValueStore } from '../storage/keyValueStore.js';
import {
  DEFAULT_MAP_VIEW,
  isMapViewState,
  sameMapView,
} from './mapViewState.js';

export const MAP_VIEW_STORAGE_KEY = 'map-view';

export interface MapViewServiceOptions {
  /** How often a changed view is written to the store. */
  saveIntervalMs?: number;
  scheduler?: SchedulerLike;
}

/**
 * Owns the map camera. Restores it from the store on startup and writes it
 * back at most once per `saveIntervalMs` while it keeps changing.
 */
@WorkerHost(MAP_VIEW_SERVICE)
export class MapViewService extends MapViewServiceBase {
  view$: Observable<MapViewState>;

  private readonly _view$ = new BehaviorSubject<MapViewState | undefined>(
    undefined,
  );
  private readonly onDestroy$ = new ReplaySubject<void>(1);
  /** Last value known to be in the store. */
  private persisted?: MapViewState;

  constructor(
    private readonly store: KeyValueStore,
    options: MapViewServiceOptions = {},
  ) {
    super();
    const { saveIntervalMs = 3000, scheduler = asyncScheduler } = options;

    this.view$ = this._view$.pipe(
      filter((view): view is MapViewState => view !== undefined),
      distinctUntilChanged(sameMapView),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.restore();

    this.view$
      .pipe(
        sampleTime(saveIntervalMs, scheduler),
        filter((view) => !this.persisted || !sameMapView(view, this.persisted)),
        concatMap((view) => this.save(view)),
        takeUntil(this.onDestroy$),
      )
      .subscribe();
  }

  setView(view: MapViewState): Observable<void> {
    return defer(() => {
      if (!isMapViewState(view)) {
        return throwError(() => new Error('Invalid map view'));
      }
      this._view$.next(view);
      return of(undefined);
    });
  }

  destroy(): void {
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }

  private restore(): void {
    this.store
      .get<unknown>(MAP_VIEW_STORAGE_KEY)
      .pipe(
        take(1),
        defaultIfEmpty(undefined),
        map((stored) => (isMapViewState(stored) ? stored : DEFAULT_MAP_VIEW)),
        catchError((err) => {
          console.warn('[map-view] restore failed, using default view', err);
          return of(DEFAULT_MAP_VIEW);
        }),
        takeUntil(this.onDestroy$),
      )
      .subscribe((view) => {
        this.persisted = view;
        // A view reported before the restore finished wins.
        if (this._view$.value === undefined) {
          this._view$.next(view);
        }
      });
  }

  private save(view: MapViewState): Observable<void> {
    return this.store.set(MAP_VIEW_STORAGE_KEY, view).pipe(
      tap(() => (this.persisted = view)),
      catchError((err) => {
        console.warn('[map-view] save failed', err);
        return EMPTY;
      }),
    );
  }
}
