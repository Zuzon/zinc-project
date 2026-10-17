import type {
  Extent,
  GridOrigin,
  TileSize,
  ZncConfig,
} from '@zinc-project/dto';
import { defaultResolutions } from '../tiles/tileGrid.js';

export const ZNC_INVALID_KEY = 'maps.import.invalidZnc';

/** A `.znc` file that cannot be imported. `key` is the i18n key for the UI. */
export class ZncParseError extends Error {
  readonly key = ZNC_INVALID_KEY;

  constructor(detail: string) {
    super(`Invalid .znc map configuration: ${detail}`);
    this.name = 'ZncParseError';
  }
}

/** On-disk `.znc` JSON: the legacy flat fields plus Zinc's declarative download fields. */
export interface ZncFile {
  name?: string;
  tileExtension: string;
  cacheType?: string;
  cachePath?: string;
  useProj?: boolean;
  epsg?: string;
  proj4?: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  originX?: number;
  originY?: number;
  tileWidth?: number;
  tileHeight?: number;
  useServer?: boolean;
  /** Legacy user JavaScript; never executed. */
  tileScript?: string;
  requestHeaders?: { key: string; value: string }[];
  useCustomResolutions?: boolean;
  resolutions?: number[];
  useMultiOrigins?: boolean;
  origins?: GridOrigin[];
  useMultiTileSizes?: boolean;
  tileSizes?: TileSize[];
  tileUrl?: string;
  subdomains?: string[];
}

const DEFAULT_EPSG = 'EPSG:3857';
const DEFAULT_TILE_SIZE = 256;

/**
 * Parses and normalizes `.znc` content. Per-level arrays are expanded and
 * sorted from the largest resolution down. The name falls back to the file
 * name without its extension. A legacy `tileScript` is ignored, so such a
 * map is served from its cache only unless it also has a `tileUrl`.
 */
export function parseZnc(content: string, fileName = ''): ZncConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new ZncParseError('not JSON');
  }
  if (!isRecord(raw)) {
    throw new ZncParseError('not a JSON object');
  }

  const format = optionalString(raw, 'tileExtension')
    ?.trim()
    .replace(/^\./, '')
    .toLowerCase();
  if (!format) {
    throw new ZncParseError('tileExtension is required');
  }

  const extent: Extent = [
    requiredNumber(raw, 'minX'),
    requiredNumber(raw, 'minY'),
    requiredNumber(raw, 'maxX'),
    requiredNumber(raw, 'maxY'),
  ];
  if (extent[0] >= extent[2] || extent[1] >= extent[3]) {
    throw new ZncParseError('extent min must be below max');
  }

  const origin: GridOrigin = [
    optionalNumber(raw, 'originX') ?? extent[0],
    optionalNumber(raw, 'originY') ?? extent[3],
  ];
  const tileSize: TileSize = [
    positive(
      optionalNumber(raw, 'tileWidth') ?? DEFAULT_TILE_SIZE,
      'tileWidth',
    ),
    positive(
      optionalNumber(raw, 'tileHeight') ?? DEFAULT_TILE_SIZE,
      'tileHeight',
    ),
  ];

  const levels = readLevels(raw, extent, origin, tileSize);

  const epsg = optionalString(raw, 'epsg')?.trim() || DEFAULT_EPSG;
  const proj4 =
    raw['useProj'] === true
      ? optionalString(raw, 'proj4')?.trim() || undefined
      : undefined;
  const tileUrl = optionalString(raw, 'tileUrl')?.trim() || undefined;
  const subdomains = readSubdomains(raw['subdomains']);
  const name =
    optionalString(raw, 'name')?.trim() || baseName(fileName) || undefined;

  return {
    ...(name ? { name } : {}),
    format,
    epsg,
    ...(proj4 ? { proj4 } : {}),
    extent,
    grid: {
      resolutions: levels.map((l) => l.resolution),
      origins: levels.map((l) => l.origin),
      tileSizes: levels.map((l) => l.tileSize),
    },
    ...(tileUrl ? { tileUrl } : {}),
    ...(subdomains.length > 0 ? { subdomains } : {}),
    headers: readHeaders(raw['requestHeaders']),
  };
}

/** Serializes a config so both Zinc and legacy shturmen-zinc can read it. */
export function writeZnc(config: ZncConfig): string {
  const { grid, extent } = config;
  const file: ZncFile = {
    ...(config.name ? { name: config.name } : {}),
    tileExtension: config.format,
    cacheType: 'tms',
    cachePath: '',
    useProj: config.proj4 !== undefined,
    epsg: config.epsg,
    proj4: config.proj4 ?? '',
    minX: extent[0],
    minY: extent[1],
    maxX: extent[2],
    maxY: extent[3],
    originX: grid.origins[0][0],
    originY: grid.origins[0][1],
    tileWidth: grid.tileSizes[0][0],
    tileHeight: grid.tileSizes[0][1],
    useServer: config.tileUrl !== undefined,
    tileScript: '',
    requestHeaders: Object.entries(config.headers).map(([key, value]) => ({
      key,
      value,
    })),
    useCustomResolutions: true,
    resolutions: grid.resolutions,
    useMultiOrigins: true,
    origins: grid.origins,
    useMultiTileSizes: true,
    tileSizes: grid.tileSizes,
    ...(config.tileUrl ? { tileUrl: config.tileUrl } : {}),
    ...(config.subdomains ? { subdomains: config.subdomains } : {}),
  };
  return JSON.stringify(file, null, 2);
}

interface Level {
  resolution: number;
  origin: GridOrigin;
  tileSize: TileSize;
}

function readLevels(
  raw: Record<string, unknown>,
  extent: Extent,
  origin: GridOrigin,
  tileSize: TileSize,
): Level[] {
  const custom = raw['useCustomResolutions'] === true;
  const resolutions = custom
    ? numberArray(raw['resolutions'], 'resolutions')
    : defaultResolutions(extent, tileSize[0]);
  if (resolutions.length === 0) {
    throw new ZncParseError('resolutions must not be empty');
  }
  resolutions.forEach((r) => positive(r, 'resolutions'));

  const origins =
    custom && raw['useMultiOrigins'] === true
      ? pairArray(raw['origins'], 'origins', resolutions.length)
      : resolutions.map(() => origin);
  const tileSizes =
    custom && raw['useMultiTileSizes'] === true
      ? pairArray(raw['tileSizes'], 'tileSizes', resolutions.length)
      : resolutions.map(() => tileSize);
  tileSizes.forEach(([w, h]) => {
    positive(w, 'tileSizes');
    positive(h, 'tileSizes');
  });

  // Sort levels together so per-level origins and sizes stay aligned.
  return resolutions
    .map((resolution, i) => ({
      resolution,
      origin: origins[i],
      tileSize: tileSizes[i],
    }))
    .sort((a, b) => b.resolution - a.resolution);
}

function readHeaders(value: unknown): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!Array.isArray(value)) {
    return headers;
  }
  for (const entry of value) {
    if (
      isRecord(entry) &&
      typeof entry['key'] === 'string' &&
      typeof entry['value'] === 'string' &&
      entry['key'].trim()
    ) {
      headers[entry['key'].trim()] = entry['value'];
    }
  }
  return headers;
}

function readSubdomains(value: unknown): string[] {
  if (typeof value === 'string') {
    return [...value];
  }
  if (Array.isArray(value)) {
    return value.filter((s): s is string => typeof s === 'string' && s !== '');
  }
  return [];
}

function baseName(fileName: string): string {
  const file = fileName.split(/[\\/]/).pop() ?? '';
  const dot = file.lastIndexOf('.');
  return (dot > 0 ? file.slice(0, dot) : file).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(
  raw: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = raw[key];
  return typeof value === 'string' ? value : undefined;
}

function optionalNumber(
  raw: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = raw[key];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new ZncParseError(`${key} must be a number`);
  }
  return n;
}

function requiredNumber(raw: Record<string, unknown>, key: string): number {
  const n = optionalNumber(raw, key);
  if (n === undefined) {
    throw new ZncParseError(`${key} is required`);
  }
  return n;
}

function positive(n: number, key: string): number {
  if (!(n > 0)) {
    throw new ZncParseError(`${key} must be positive`);
  }
  return n;
}

function numberArray(value: unknown, key: string): number[] {
  if (!Array.isArray(value)) {
    throw new ZncParseError(`${key} must be an array`);
  }
  return value.map((v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) {
      throw new ZncParseError(`${key} must contain numbers`);
    }
    return n;
  });
}

function pairArray(
  value: unknown,
  key: string,
  length: number,
): [number, number][] {
  if (!Array.isArray(value) || value.length !== length) {
    throw new ZncParseError(`${key} must have one entry per resolution`);
  }
  return value.map((pair) => {
    const numbers = numberArray(pair, key);
    if (numbers.length !== 2) {
      throw new ZncParseError(`${key} entries must be pairs`);
    }
    return [numbers[0], numbers[1]];
  });
}
