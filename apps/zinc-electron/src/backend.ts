import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { MessagePortMain } from 'electron';
import { config, interval } from 'rxjs';
import {
  PortHostSocketHandler,
  WebSocketHost,
  rxjsBridgeHealthMonitor,
} from 'rxjs-bridge';
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
import { portConnection } from './portConnection.js';

export interface DesktopBackendOptions {
  /** Per-user data directory (maps, later tracks and routes). */
  dataDir: string;
  /** The bundled `@zinc-project/data/worker` entry. */
  dbWorkerFile: string;
}

export interface DesktopBackend {
  readonly maps: MapsService;
  /** Hosts every backend service on a renderer's port. */
  connect(port: MessagePortMain, address: string): void;
  destroy(): Promise<void>;
}

/**
 * Backend composition root of the desktop app: the same services as
 * zinc-server, hosted over Electron message ports instead of WebSocket.
 */
export function startBackend(options: DesktopBackendOptions): DesktopBackend {
  config.onUnhandledError = (err) => {
    console.error('[backend] unhandled rx error', err);
  };

  const mapsDir = join(options.dataDir, 'maps');
  mkdirSync(mapsDir, { recursive: true });
  console.info('[backend] map databases', mapsDir);

  const worker = createDataWorker({ mapsDir }, options.dbWorkerFile);
  worker.on('error', (err) => console.error('[backend] DB worker failed', err));
  const store = createMapStoreBridge(worker);

  const downloader = new TileDownloader();
  const maps = new MapsService(store, downloader, {
    tileUrl: tileUrlTemplate,
    defaultMaps: [OSM_MAP],
  });

  // Hosts must exist before the first renderer connects.
  const ports = new PortHostSocketHandler();
  hostMapsService(WebSocketHost(MAPS_SERVICE, ports), maps);

  const health = interval(60_000).subscribe(() => {
    console.debug(
      '[backend] rxjs-bridge health',
      rxjsBridgeHealthMonitor.checkHealth(),
    );
  });

  return {
    maps,
    connect(port, address) {
      ports.connect(portConnection(port, address));
      port.start();
    },
    async destroy() {
      health.unsubscribe();
      maps.destroy();
      downloader.destroy();
      await worker.terminate();
    },
  };
}
