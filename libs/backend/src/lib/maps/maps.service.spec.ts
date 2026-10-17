import { firstValueFrom, lastValueFrom, skipWhile } from 'rxjs';
import { ZNC_INVALID_KEY } from '@zinc-project/utils';
import {
  MemoryMapStore,
  pngTile,
  testConfig,
} from '../testing/memoryMapStore.js';
import { MapsService } from './maps.service.js';
import { TileDownloader } from './tileDownloader.js';

const HALF = 20037508.342789244;
const zncFile = JSON.stringify({
  tileExtension: 'jpg',
  epsg: 'EPSG:3857',
  minX: -HALF,
  minY: -HALF,
  maxX: HALF,
  maxY: HALF,
  originX: -HALF,
  originY: HALF,
  tileUrl: 'https://example.test/{z}/{x}/{y}.jpg',
});

describe('MapsService', () => {
  let store: MemoryMapStore;
  let downloader: TileDownloader;
  let service: MapsService | undefined;
  const create = (defaultMaps = [testConfig({ name: 'Default' })]) =>
    (service = new MapsService(store, downloader, {
      tileUrl: (id) => `/api/maps/${id}/tiles/{z}/{x}/{y}`,
      defaultMaps,
    }));

  beforeEach(() => {
    store = new MemoryMapStore();
    downloader = new TileDownloader({
      fetch: async () =>
        new Response(new Uint8Array([5]), {
          headers: { 'content-type': 'image/png' },
        }),
    });
  });

  afterEach(() => {
    service?.destroy();
    downloader.destroy();
  });

  it('seeds the default maps into an empty store', async () => {
    const maps = await firstValueFrom(create().maps$);

    expect(maps.map((m) => m.name)).toEqual(['Default']);
    expect(maps[0].tileUrl).toBe(`/api/maps/${maps[0].id}/tiles/{z}/{x}/{y}`);
  });

  it('does not seed when maps already exist', async () => {
    await lastValueFrom(store.createMap('Mine', testConfig()));

    const maps = await firstValueFrom(create().maps$);
    expect(maps.map((m) => m.name)).toEqual(['Mine']);
  });

  it('imports a .znc file and lists it', async () => {
    const maps = create();
    await firstValueFrom(maps.maps$);

    const imported = await lastValueFrom(
      maps.importZnc('C:\\maps\\Topo.znc', zncFile),
    );

    expect(imported).toMatchObject({ name: 'Topo', format: 'jpg' });
    const listed = await firstValueFrom(
      maps.maps$.pipe(skipWhile((list) => list.length < 2)),
    );
    expect(listed.map((m) => m.name)).toEqual(['Default', 'Topo']);
  });

  it('rejects an invalid .znc with the i18n key', async () => {
    await expect(
      lastValueFrom(create().importZnc('bad.znc', '{"tileExtension":""}')),
    ).rejects.toMatchObject({ key: ZNC_INVALID_KEY });
    expect(store.writes).toEqual([]);
  });

  it('serves tiles through the map handler, cache first', async () => {
    const maps = create();
    const [map] = await firstValueFrom(maps.maps$);
    store.tiles.set(`${map.id}/0/0/0`, pngTile(9));

    expect(await firstValueFrom(maps.getTile(map.id, 0, 0, 0))).toEqual(
      pngTile(9),
    );
    expect(await firstValueFrom(maps.getTile(map.id, 1, 0, 0))).toEqual({
      data: new Uint8Array([5]),
      contentType: 'image/png',
    });
  });

  it('returns null for an unknown map', async () => {
    expect(await firstValueFrom(create().getTile('nope', 0, 0, 0))).toBeNull();
  });
});
