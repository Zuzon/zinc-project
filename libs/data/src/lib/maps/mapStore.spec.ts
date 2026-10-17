import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import type { ZncConfig } from '@zinc-project/dto';
import { MapStore } from './mapStore.js';

const config: ZncConfig = {
  format: 'jpg',
  epsg: 'EPSG:3857',
  extent: [0, 0, 512, 512],
  grid: { resolutions: [2], origins: [[0, 512]], tileSizes: [[256, 256]] },
  headers: {},
};
const tile = { data: new Uint8Array([1, 2, 3]), contentType: 'image/jpeg' };

describe('MapStore', () => {
  let dir: string;
  let store: MapStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'zinc-mapstore-'));
    store = new MapStore(dir);
  });

  afterEach(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('starts empty', async () => {
    expect(await firstValueFrom(store.maps$)).toEqual([]);
  });

  it('creates one database file per map and lists maps in creation order', async () => {
    const first = await lastValueFrom(store.createMap('First', config));
    const second = await lastValueFrom(store.createMap('Second', config));

    expect(
      readdirSync(dir)
        .filter((f) => f.endsWith('.znm'))
        .sort(),
    ).toEqual([`${first.id}.znm`, `${second.id}.znm`].sort());
    const maps = await firstValueFrom(store.maps$);
    expect(maps.map((m) => m.name)).toEqual(['First', 'Second']);
  });

  it('finds existing maps and their tiles after a restart', async () => {
    const map = await lastValueFrom(store.createMap('Kept', config));
    await lastValueFrom(store.putTile(map.id, 0, 1, 1, tile));
    store.close();

    store = new MapStore(dir);
    expect(await firstValueFrom(store.maps$)).toEqual([map]);
    expect(await lastValueFrom(store.getTile(map.id, 0, 1, 1))).toEqual(tile);
  });

  it('skips files that are not map databases', async () => {
    writeFileSync(join(dir, 'broken.znm'), 'not sqlite');
    store.close();
    store = new MapStore(dir);
    expect(await firstValueFrom(store.maps$)).toEqual([]);
  });

  it('returns null for uncached tiles and unknown maps', async () => {
    const map = await lastValueFrom(store.createMap('Empty', config));
    expect(await lastValueFrom(store.getTile(map.id, 0, 0, 0))).toBeNull();
    expect(await lastValueFrom(store.getTile('nope', 0, 0, 0))).toBeNull();
  });

  it('fails to store a tile for an unknown map', async () => {
    await expect(
      lastValueFrom(store.putTile('nope', 0, 0, 0, tile)),
    ).rejects.toThrow('Unknown map nope');
  });
});
