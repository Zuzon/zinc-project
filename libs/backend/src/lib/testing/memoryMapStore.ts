import { BehaviorSubject, Observable, defer, of } from 'rxjs';
import { MapStoreServiceBase } from '@zinc-project/contracts';
import type { StoredMap, TileData, ZncConfig } from '@zinc-project/dto';

/** In-memory {@link MapStoreServiceBase} for specs. */
export class MemoryMapStore extends MapStoreServiceBase {
  readonly tiles = new Map<string, TileData>();
  readonly reads: string[] = [];
  readonly writes: string[] = [];
  private readonly _maps$: BehaviorSubject<StoredMap[]>;
  private nextId = 1;
  maps$: Observable<StoredMap[]>;

  constructor(maps: StoredMap[] = []) {
    super();
    this._maps$ = new BehaviorSubject(maps);
    this.maps$ = this._maps$.asObservable();
  }

  createMap(name: string, config: ZncConfig): Observable<StoredMap> {
    return defer(() => {
      const map: StoredMap = {
        id: `map-${this.nextId++}`,
        name,
        config,
        createdAt: Date.now(),
      };
      this._maps$.next([...this._maps$.value, map]);
      return of(map);
    });
  }

  getTile(
    mapId: string,
    z: number,
    x: number,
    y: number,
  ): Observable<TileData | null> {
    return defer(() => {
      const key = `${mapId}/${z}/${x}/${y}`;
      this.reads.push(key);
      return of(this.tiles.get(key) ?? null);
    });
  }

  putTile(
    mapId: string,
    z: number,
    x: number,
    y: number,
    tile: TileData,
  ): Observable<void> {
    return defer(() => {
      const key = `${mapId}/${z}/${x}/${y}`;
      this.writes.push(key);
      this.tiles.set(key, tile);
      return of(undefined);
    });
  }
}

/** Two-level 256 px Web-Mercator-like grid over `[0, 0, 512, 512]`. */
export const testConfig = (overrides: Partial<ZncConfig> = {}): ZncConfig => ({
  name: 'Test',
  format: 'png',
  epsg: 'EPSG:3857',
  extent: [0, 0, 512, 512],
  grid: {
    resolutions: [2, 1],
    origins: [
      [0, 512],
      [0, 512],
    ],
    tileSizes: [
      [256, 256],
      [256, 256],
    ],
  },
  tileUrl: 'https://tiles.test/{z}/{x}/{y}.png',
  headers: { 'User-Agent': 'zinc-test' },
  ...overrides,
});

export const pngTile = (byte = 1): TileData => ({
  data: new Uint8Array([byte]),
  contentType: 'image/png',
});
