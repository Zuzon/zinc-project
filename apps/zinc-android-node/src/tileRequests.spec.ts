import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { of } from 'rxjs';
import type { TileSource } from '@zinc-project/backend';
import { tileRequestHandler } from './tileRequests.js';

const TOKEN = 'secret';

describe('tileRequestHandler', () => {
  let server: Server;
  let base: string;
  const getTile = vi.fn<TileSource['getTile']>();

  beforeEach(async () => {
    getTile.mockReset();
    server = createServer(tileRequestHandler({ getTile }, TOKEN));
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('serves a cached tile to a request with the token', async () => {
    getTile.mockReturnValue(
      of({ data: new Uint8Array([1, 2, 3]), contentType: 'image/png' }),
    );

    const res = await fetch(`${base}/api/maps/m%201/tiles/3/4/-5?t=${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(getTile).toHaveBeenCalledWith('m 1', 3, 4, -5);
  });

  it('refuses requests without the token', async () => {
    const res = await fetch(`${base}/api/maps/m/tiles/3/4/5?t=wrong`);

    expect(res.status).toBe(403);
    expect(getTile).not.toHaveBeenCalled();
  });

  it('answers 404 for anything but a tile path', async () => {
    const res = await fetch(`${base}/index.html?t=${TOKEN}`);

    expect(res.status).toBe(404);
  });

  it('answers 404 for a tile that is not available', async () => {
    getTile.mockReturnValue(of(null));

    const res = await fetch(`${base}/api/maps/m/tiles/3/4/5?t=${TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
