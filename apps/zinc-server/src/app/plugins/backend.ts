import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
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
} from '@zinc-project/backend';
import { MAPS_SERVICE } from '@zinc-project/contracts';
import { createDataWorker } from '@zinc-project/data';
import { appDataDir } from '../appDataDir';

declare module 'fastify' {
  interface FastifyInstance {
    maps: MapsService;
  }
}

/** WebSocket path the frontend's rxjs-bridge clients connect to. */
export const BRIDGE_PATH = '/rx';

/**
 * Backend composition root: starts the DB worker, builds the backend
 * services and hosts them over WebSocket on the Fastify HTTP server.
 */
export default fp(
  async function backend(fastify: FastifyInstance) {
    config.onUnhandledError = (err) => {
      fastify.log.error({ err }, 'unhandled rx error');
    };

    const mapsDir = join(appDataDir(), 'maps');
    mkdirSync(mapsDir, { recursive: true });
    fastify.log.info({ mapsDir }, 'map databases');

    const worker = createDataWorker({ mapsDir });
    worker.on('error', (err) => fastify.log.error({ err }, 'DB worker failed'));
    const store = createMapStoreBridge(worker);

    const downloader = new TileDownloader();
    const maps = new MapsService(store, downloader, {
      tileUrl: (id) => `/api/maps/${encodeURIComponent(id)}/tiles/{z}/{x}/{y}`,
      defaultMaps: [OSM_MAP],
    });

    // Hosts must exist before the first client connects, i.e. before listen().
    const wss = new WebSocketServer({
      server: fastify.server,
      path: BRIDGE_PATH,
    });
    const sockets = new HostSocketHandler(wss);
    hostMapsService(WebSocketHost(MAPS_SERVICE, sockets), maps);

    fastify.decorate('maps', maps);

    const health = interval(60_000).subscribe(() => {
      fastify.log.debug(
        { health: rxjsBridgeHealthMonitor.checkHealth() },
        'rxjs-bridge health',
      );
    });

    fastify.addHook('onClose', async () => {
      health.unsubscribe();
      maps.destroy();
      downloader.destroy();
      for (const client of wss.clients) {
        client.terminate();
      }
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await worker.terminate();
    });
  },
  { name: 'backend' },
);
