import axios from 'axios';
import { existsSync } from 'node:fs';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import {
  type Observable,
  filter,
  firstValueFrom,
  lastValueFrom,
  timeout,
} from 'rxjs';
import {
  SocketMethod,
  SocketObservable,
  WebSocketBridge,
  WebSocketHandler,
} from 'rxjs-bridge';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { MAPS_SERVICE, MapsServiceBase } from '@zinc-project/contracts';
import type { MapInfo } from '@zinc-project/dto';

/** Smallest valid PNG: one transparent pixel. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const HALF = 20037508.342789244;

/** Upstream tile server that counts every request it serves. */
function startTileServer(): Promise<{
  server: Server;
  url: string;
  hits: string[];
}> {
  const hits: string[] = [];
  const server = createServer((req, res) => {
    hits.push(req.url ?? '');
    res.writeHead(200, { 'content-type': 'image/png' }).end(PNG);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}`, hits });
    }),
  );
}

function connectMaps(baseUrl: string): MapsServiceBase {
  const socket = new WebSocketHandler(`${baseUrl.replace(/^http/, 'ws')}/rx`);
  socket.start();

  @WebSocketBridge(socket, MAPS_SERVICE)
  class MapsBridge extends MapsServiceBase {
    @SocketObservable()
    override maps$!: Observable<MapInfo[]>;

    @SocketMethod()
    override importZnc(): Observable<MapInfo> {
      throw new Error('bridge stub');
    }
  }

  return new MapsBridge();
}

describe('maps service', () => {
  let upstream: Awaited<ReturnType<typeof startTileServer>>;
  let maps: MapsServiceBase;

  beforeAll(async () => {
    upstream = await startTileServer();
    maps = connectMaps(inject('baseUrl'));
  });

  afterAll(() => {
    upstream.server.close();
  });

  const nextMaps = (match: (list: MapInfo[]) => boolean) =>
    firstValueFrom(maps.maps$.pipe(filter(match), timeout(10_000)));

  it('lists the seeded OpenStreetMap map', async () => {
    const list = await nextMaps((l) => l.length > 0);

    expect(list[0]).toMatchObject({
      name: 'OpenStreetMap',
      epsg: 'EPSG:3857',
      format: 'png',
      tileUrl: `/api/maps/${list[0].id}/tiles/{z}/{x}/{y}`,
    });
  });

  it('imports a .znc map into its own database and serves its tiles cache-first', async () => {
    const znc = JSON.stringify({
      name: 'Fake',
      tileExtension: 'png',
      epsg: 'EPSG:3857',
      minX: -HALF,
      minY: -HALF,
      maxX: HALF,
      maxY: HALF,
      originX: -HALF,
      originY: HALF,
      tileUrl: `${upstream.url}/{z}/{x}/{y}.png`,
    });

    const imported = await lastValueFrom(
      maps.importZnc('fake.znc', znc).pipe(timeout(10_000)),
    );
    expect(imported.name).toBe('Fake');
    await nextMaps((l) => l.some((m) => m.id === imported.id));
    expect(
      existsSync(join(inject('dataDir'), 'maps', `${imported.id}.znm`)),
    ).toBe(true);

    const tilePath = `/api/maps/${imported.id}/tiles/1/0/1`;
    const first = await axios.get(tilePath, { responseType: 'arraybuffer' });
    expect(first.status).toBe(200);
    expect(first.headers['content-type']).toBe('image/png');
    expect(Buffer.from(first.data)).toEqual(PNG);
    expect(upstream.hits).toEqual(['/1/0/1.png']);

    // Give the fire-and-forget cache write time to land in the DB worker.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const second = await axios.get(tilePath, { responseType: 'arraybuffer' });
    expect(Buffer.from(second.data)).toEqual(PNG);
    expect(upstream.hits).toEqual(['/1/0/1.png']);
  });

  it('answers 404 for a tile outside the grid or an unknown map', async () => {
    const [osm] = await nextMaps((l) => l.length > 0);
    const status = (path: string) =>
      axios.get(path, { validateStatus: () => true }).then((r) => r.status);

    expect(await status(`/api/maps/${osm.id}/tiles/1/5/0`)).toBe(404);
    expect(await status('/api/maps/nope/tiles/0/0/0')).toBe(404);
    expect(await status(`/api/maps/${osm.id}/tiles/a/0/0`)).toBe(400);
  });

  it('rejects an invalid .znc with an i18n key', async () => {
    await expect(
      lastValueFrom(maps.importZnc('bad.znc', '{}').pipe(timeout(10_000))),
    ).rejects.toMatchObject({ key: 'maps.import.invalidZnc' });
  });
});
