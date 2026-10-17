import { Observable, Subject, firstValueFrom } from 'rxjs';
import type { StoredMap, TileData } from '@zinc-project/dto';
import {
  MemoryMapStore,
  pngTile,
  testConfig,
} from '../testing/memoryMapStore.js';
import { MapHandler } from './mapHandler.js';
import type { TileDownloader, TileRequest } from './tileDownloader.js';

/** Records requests; each download emits once the test pushes a tile. */
class StubDownloader {
  readonly requests: TileRequest[] = [];
  readonly results = new Subject<TileData | null>();

  download(request: TileRequest): Observable<TileData | null> {
    this.requests.push(request);
    return new Observable((subscriber) =>
      this.results.subscribe((tile) => {
        subscriber.next(tile);
        subscriber.complete();
      }),
    );
  }
}

const stored = (config = testConfig()): StoredMap => ({
  id: 'm',
  name: 'Test',
  config,
  createdAt: 0,
});

describe('MapHandler', () => {
  let store: MemoryMapStore;
  let downloader: StubDownloader;
  const handlers: MapHandler[] = [];
  const create = (map = stored()) => {
    const handler = new MapHandler(
      map,
      '/tiles/m/{z}/{x}/{y}',
      store,
      downloader as unknown as TileDownloader,
    );
    handlers.push(handler);
    return handler;
  };

  beforeEach(() => {
    store = new MemoryMapStore();
    downloader = new StubDownloader();
  });

  afterEach(() => handlers.splice(0).forEach((h) => h.destroy()));

  it('describes the map with the host tile URL', () => {
    expect(create().info).toMatchObject({
      id: 'm',
      name: 'Test',
      bbox: [0, 0, 512, 512],
      minResolution: 1,
      maxResolution: 2,
      epsg: 'EPSG:3857',
      format: 'png',
      tileUrl: '/tiles/m/{z}/{x}/{y}',
    });
  });

  it('serves a cached tile without downloading', async () => {
    store.tiles.set('m/1/1/0', pngTile(7));

    expect(await firstValueFrom(create().getTile(1, 1, 0))).toEqual(pngTile(7));
    expect(downloader.requests).toEqual([]);
  });

  it('downloads a missing tile and caches it', async () => {
    const tile = firstValueFrom(create().getTile(1, 1, 0));
    downloader.results.next(pngTile(3));

    expect(await tile).toEqual(pngTile(3));
    expect(downloader.requests).toEqual([
      {
        url: 'https://tiles.test/1/1/0.png',
        headers: { 'User-Agent': 'zinc-test' },
      },
    ]);
    expect(store.tiles.get('m/1/1/0')).toEqual(pngTile(3));
  });

  it('does not cache a tile the server does not have', async () => {
    const tile = firstValueFrom(create().getTile(1, 1, 0));
    downloader.results.next(null);

    expect(await tile).toBeNull();
    expect(store.writes).toEqual([]);
  });

  it('returns null for tiles outside the grid without any I/O', async () => {
    const handler = create();

    expect(await firstValueFrom(handler.getTile(1, 2, 0))).toBeNull();
    expect(await firstValueFrom(handler.getTile(2, 0, 0))).toBeNull();
    expect(store.reads).toEqual([]);
    expect(downloader.requests).toEqual([]);
  });

  it('shares one lookup between concurrent requests for a tile', async () => {
    const handler = create();
    const a = firstValueFrom(handler.getTile(0, 0, 0));
    const b = firstValueFrom(handler.getTile(0, 0, 0));
    downloader.results.next(pngTile());

    expect(await a).toEqual(pngTile());
    expect(await b).toEqual(pngTile());
    expect(store.reads).toEqual(['m/0/0/0']);
    expect(downloader.requests).toHaveLength(1);
  });

  it('returns null for an uncached tile of a cache-only map', async () => {
    const handler = create(stored(testConfig({ tileUrl: undefined })));

    expect(await firstValueFrom(handler.getTile(0, 0, 0))).toBeNull();
    expect(downloader.requests).toEqual([]);
  });

  it('downloads when the cache cannot be read', async () => {
    store.getTile = () =>
      new Observable((s) => s.error(new Error('disk gone')));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const tile = firstValueFrom(create().getTile(0, 0, 0));
    downloader.results.next(pngTile());

    expect(await tile).toEqual(pngTile());
    warn.mockRestore();
  });

  it('stops with its parent', () => {
    const parent = new Subject<void>();
    const handler = new MapHandler(
      stored(),
      '',
      store,
      downloader as unknown as TileDownloader,
      parent,
    );
    let completed = false;
    handler.getTile(0, 0, 0).subscribe({ complete: () => (completed = true) });

    parent.next();
    expect(completed).toBe(true);
  });
});
