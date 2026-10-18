import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type Rgb, solidPng } from './solidPng.js';

export interface TileServer {
  /** Base URL; `<url>/<colour>/{z}/{x}/{y}.png` serves solid tiles. */
  url: string;
  close(): Promise<void>;
}

/** Upstream tile server standing in for OSM & co., so e2e never needs the internet. */
export async function startTileServer(
  colours: Record<string, Rgb>,
): Promise<TileServer> {
  const tiles = new Map(
    Object.entries(colours).map(([name, rgb]) => [
      name,
      solidPng(256, 256, rgb),
    ]),
  );
  const server: Server = createServer((req, res) => {
    const name = /^\/([^/]+)\/-?\d+\/-?\d+\/-?\d+\.png$/.exec(
      req.url ?? '',
    )?.[1];
    const tile = name ? tiles.get(name) : undefined;
    if (!tile) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': 'image/png' }).end(tile);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
