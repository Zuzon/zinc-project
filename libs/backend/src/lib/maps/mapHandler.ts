import {
  EMPTY,
  Observable,
  ReplaySubject,
  catchError,
  defaultIfEmpty,
  finalize,
  of,
  share,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs';
import type { MapStoreServiceBase } from '@zinc-project/contracts';
import type { MapInfo, StoredMap, TileData } from '@zinc-project/dto';
import { expandTileUrl, isTileInGrid } from '@zinc-project/utils';
import { toMapInfo } from './mapInfo.js';
import type { TileDownloader } from './tileDownloader.js';

/**
 * Serves one map's tiles: from its cache first, otherwise downloaded and
 * written back to the cache. Concurrent requests for one tile share a lookup.
 */
export class MapHandler {
  readonly info: MapInfo;

  private readonly onDestroy$ = new ReplaySubject<void>(1);
  private readonly pending = new Map<string, Observable<TileData | null>>();

  constructor(
    readonly map: StoredMap,
    tileUrl: string,
    private readonly store: MapStoreServiceBase,
    private readonly downloader: TileDownloader,
    parentDestroy$?: Observable<void>,
  ) {
    this.info = toMapInfo(map, tileUrl);
    parentDestroy$
      ?.pipe(take(1), takeUntil(this.onDestroy$))
      .subscribe(() => this.destroy());
  }

  /** Emits the tile, or `null` when it is outside the grid or unavailable offline. */
  getTile(z: number, x: number, y: number): Observable<TileData | null> {
    const { grid, extent } = this.map.config;
    if (!isTileInGrid(grid, extent, { z, x, y })) {
      return of(null);
    }
    const key = `${z}/${x}/${y}`;
    let tile$ = this.pending.get(key);
    if (!tile$) {
      tile$ = this.store.getTile(this.map.id, z, x, y).pipe(
        take(1),
        defaultIfEmpty(null),
        catchError((err) => {
          console.warn(
            `[maps] cache read failed for ${this.map.id}/${key}`,
            err,
          );
          return of(null);
        }),
        switchMap((cached) => (cached ? of(cached) : this.download(z, x, y))),
        finalize(() => this.pending.delete(key)),
        takeUntil(this.onDestroy$),
        share(),
      );
      this.pending.set(key, tile$);
    }
    return tile$;
  }

  destroy(): void {
    this.onDestroy$.next();
    this.onDestroy$.complete();
  }

  private download(
    z: number,
    x: number,
    y: number,
  ): Observable<TileData | null> {
    const { tileUrl, subdomains, headers } = this.map.config;
    if (!tileUrl) {
      return of(null);
    }
    return this.downloader
      .download({
        url: expandTileUrl(tileUrl, { z, x, y }, subdomains),
        headers,
      })
      .pipe(
        tap((tile) => {
          if (tile) {
            this.save(z, x, y, tile);
          }
        }),
      );
  }

  /** Fire-and-forget: the caller gets the tile even when caching it fails. */
  private save(z: number, x: number, y: number, tile: TileData): void {
    this.store
      .putTile(this.map.id, z, x, y, tile)
      .pipe(
        take(1),
        catchError((err) => {
          console.warn(
            `[maps] cache write failed for ${this.map.id}/${z}/${x}/${y}`,
            err,
          );
          return EMPTY;
        }),
        takeUntil(this.onDestroy$),
      )
      .subscribe();
  }
}
