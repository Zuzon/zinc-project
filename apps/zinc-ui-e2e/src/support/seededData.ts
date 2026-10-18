import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MapDb } from '@zinc-project/data';
import { parseZnc } from '@zinc-project/utils';
import type { Rgb } from './solidPng.js';
import { type TileServer, startTileServer } from './tileServer.js';

export const RED: Rgb = [220, 40, 40];
export const BLUE: Rgb = [40, 80, 220];

/** Map ids in the order the app lists them (oldest first): red is active at start. */
export const MAP_IDS = { red: 'e2e-red', blue: 'e2e-blue' } as const;

const HALF = 20037508.342789244;

export interface SeededData {
  /** ZINC_DATA_DIR for the app under test. */
  dataDir: string;
  dispose(): Promise<void>;
}

/**
 * A fresh data dir holding two maps whose tiles come from a local upstream
 * server. With maps present, the backend seeds no OpenStreetMap map.
 */
export async function createSeededData(): Promise<SeededData> {
  const upstream: TileServer = await startTileServer({ red: RED, blue: BLUE });
  const dataDir = mkdtempSync(join(tmpdir(), 'zinc-ui-e2e-'));
  const mapsDir = join(dataDir, 'maps');
  mkdirSync(mapsDir);

  let createdAt = 1;
  for (const [colour, id] of Object.entries(MAP_IDS)) {
    const config = parseZnc(
      JSON.stringify({
        name: `E2E ${colour}`,
        tileExtension: 'png',
        epsg: 'EPSG:3857',
        minX: -HALF,
        minY: -HALF,
        maxX: HALF,
        maxY: HALF,
        originX: -HALF,
        originY: HALF,
        tileUrl: `${upstream.url}/${colour}/{z}/{x}/{y}.png`,
      }),
    );
    MapDb.create(
      join(mapsDir, `${id}.znm`),
      config.name ?? id,
      config,
      createdAt++,
    ).close();
  }

  return {
    dataDir,
    async dispose() {
      await upstream.close();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
