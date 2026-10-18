import { mkdirSync } from 'node:fs';
import { type Server, createServer } from 'node:http';
import { join } from 'node:path';
import { config, interval } from 'rxjs';
import {
  HostSocketHandler,
  WebSocketHost,
  rxjsBridgeHealthMonitor,
} from 'rxjs-bridge';
import { WebSocketServer } from 'ws';
import {
  MapsService,
  OSM_MAP,
  TileDownloader,
  createMapStoreBridge,
  hostMapsService,
  tileUrlTemplate,
} from '@zinc-project/backend';
import { MAPS_SERVICE } from '@zinc-project/contracts';
import { createDataWorker } from '@zinc-project/data';
import { hasToken, withToken } from './access.js';
import type { BackendEnv } from './env.js';
import { tileRequestHandler } from './tileRequests.js';

/** WebSocket path the frontend's rxjs-bridge clients connect to. */
export const BRIDGE_PATH = '/rx';

/** Only the device itself may connect, and only with the token. */
const LOOPBACK = '127.0.0.1';

export interface AndroidBackend {
  readonly server: Server;
  destroy(): Promise<void>;
}

/**
 * Backend composition root of the Android app: the same services as
 * zinc-server, hosted over WebSocket and HTTP on a loopback port that the
 * WebView reaches with a per-launch token.
 */
export function startBackend(
  env: BackendEnv,
  dbWorkerFile: string,
): AndroidBackend {
  config.onUnhandledError = (err) => {
    console.error('[backend] unhandled rx error', err);
  };

  const mapsDir = join(env.dataDir, 'maps');
  mkdirSync(mapsDir, { recursive: true });
  console.info('[backend] map databases', mapsDir);

  const worker = createDataWorker(
    { mapsDir, sqliteBinding: env.sqliteBinding },
    dbWorkerFile,
  );
  worker.on('error', (err) => console.error('[backend] DB worker failed', err));
  const store = createMapStoreBridge(worker);

  // The WebView is served from another origin, so tile URLs are absolute.
  const origin = `http://${LOOPBACK}:${env.port}`;
  const downloader = new TileDownloader();
  const maps = new MapsService(store, downloader, {
    tileUrl: (mapId) => withToken(origin + tileUrlTemplate(mapId), env.token),
    defaultMaps: [OSM_MAP],
  });

  const server = createServer(tileRequestHandler(maps, env.token));
  // Hosts must exist before the first client connects, i.e. before listen().
  const wss = new WebSocketServer({
    server,
    path: BRIDGE_PATH,
    verifyClient: ({ req }: { req: { url?: string } }) =>
      hasToken(req.url, env.token),
  });
  const sockets = new HostSocketHandler(wss);
  hostMapsService(WebSocketHost(MAPS_SERVICE, sockets), maps);

  server.on('error', (err) => console.error('[backend] server failed', err));
  server.listen(
    env.listenFd === undefined
      ? { port: env.port, host: LOOPBACK }
      : { fd: env.listenFd },
    () => console.info('[backend] listening on', origin),
  );

  const health = interval(60_000).subscribe(() => {
    console.debug(
      '[backend] rxjs-bridge health',
      rxjsBridgeHealthMonitor.checkHealth(),
    );
  });

  return {
    server,
    async destroy() {
      health.unsubscribe();
      maps.destroy();
      downloader.destroy();
      for (const client of wss.clients) {
        client.terminate();
      }
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await worker.terminate();
    },
  };
}
