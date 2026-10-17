import {
  BehaviorSubject,
  EMPTY,
  Observable,
  ReplaySubject,
  catchError,
  concat,
  concatMap,
  defer,
  filter,
  ignoreElements,
  map,
  of,
  shareReplay,
  switchMap,
  take,
  takeUntil,
} from 'rxjs';
import {
  MapsServiceBase,
  type MapStoreServiceBase,
} from '@zinc-project/contracts';
import type {
  MapInfo,
  StoredMap,
  TileData,
  ZncConfig,
} from '@zinc-project/dto';
import { parseZnc } from '@zinc-project/utils';
import { MapHandler } from './mapHandler.js';
import { toMapInfo } from './mapInfo.js';
import type { TileDownloader } from './tileDownloader.js';

export interface MapsServiceOptions {
  /** Tile URL template (`{z}/{x}/{y}`) under which the host serves a map's tiles. */
  tileUrl: (mapId: string) => string;
  /** Created when the store holds no maps at all, i.e. on first run. */
  defaultMaps?: ZncConfig[];
}

const FALLBACK_NAME = 'Map';

/**
 * The backend's maps: lists them, imports `.znc` configurations and serves
 * tiles through one {@link MapHandler} per map. Transport-neutral; host it
 * with {@link hostMapsService}.
 */
export class MapsService extends MapsServiceBase {
  maps$: Observable<MapInfo[]>;

  private readonly _handlers$ = new BehaviorSubject<
    ReadonlyMap<string, MapHandler> | undefined
  >(undefined);
  private readonly handlers$: Observable<ReadonlyMap<string, MapHandler>>;
  private readonly onDestroy$ = new ReplaySubject<void>(1);

  constructor(
    private readonly store: MapStoreServiceBase,
    private readonly downloader: TileDownloader,
    private readonly options: MapsServiceOptions,
  ) {
    super();
    this.handlers$ = this._handlers$.pipe(
      filter((h): h is ReadonlyMap<string, MapHandler> => h !== undefined),
    );
    this.maps$ = this.handlers$.pipe(
      map((handlers) => [...handlers.values()].map((h) => h.info)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    concat(this.seed(), store.maps$)
      .pipe(takeUntil(this.onDestroy$))
      .subscribe((maps) => this.reconcile(maps));
  }

  importZnc(fileName: string, content: string): Observable<MapInfo> {
    return defer(() => {
      const config = parseZnc(content, fileName);
      return this.store.createMap(config.name ?? FALLBACK_NAME, config);
    }).pipe(
      take(1),
      map((stored) => toMapInfo(stored, this.options.tileUrl(stored.id))),
    );
  }

  /** Emits the tile, or `null` for an unknown map or a tile it cannot provide. */
  getTile(
    mapId: string,
    z: number,
    x: number,
    y: number,
  ): Observable<TileData | null> {
    return this.handlers$.pipe(
      take(1),
      switchMap(
        (handlers) => handlers.get(mapId)?.getTile(z, x, y) ?? of(null),
      ),
    );
  }

  destroy(): void {
    this.onDestroy$.next();
    this.onDestroy$.complete();
    this._handlers$.complete();
  }

  /** Creates the default maps when the store is empty; emits nothing. */
  private seed(): Observable<never> {
    const defaults = this.options.defaultMaps ?? [];
    return this.store.maps$.pipe(
      take(1),
      switchMap((maps) =>
        maps.length > 0 || defaults.length === 0
          ? EMPTY
          : of(...defaults).pipe(
              concatMap((config) =>
                this.store
                  .createMap(config.name ?? FALLBACK_NAME, config)
                  .pipe(take(1)),
              ),
            ),
      ),
      ignoreElements(),
      catchError((err) => {
        console.warn('[maps] seeding default maps failed', err);
        return EMPTY;
      }),
    );
  }

  private reconcile(maps: StoredMap[]): void {
    const previous = this._handlers$.value ?? new Map<string, MapHandler>();
    const next = new Map<string, MapHandler>();
    for (const stored of maps) {
      next.set(
        stored.id,
        previous.get(stored.id) ??
          new MapHandler(
            stored,
            this.options.tileUrl(stored.id),
            this.store,
            this.downloader,
            this.onDestroy$,
          ),
      );
    }
    for (const [id, handler] of previous) {
      if (!next.has(id)) {
        handler.destroy();
      }
    }
    this._handlers$.next(next);
  }
}
