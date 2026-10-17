import type { Extent, MapGrid } from '@zinc-project/dto';

/** Inclusive tile index range of one zoom level. */
export interface TileRange {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Tile coordinate in OpenLayers' convention: `y` grows down from the level origin. */
export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

/** Legacy default: zoom 0 spans the extent width with one tile, halving per level. */
export function defaultResolutions(
  extent: Extent,
  tileWidth: number,
  levels = 23,
): number[] {
  const start = (extent[2] - extent[0]) / tileWidth;
  return Array.from({ length: levels }, (_, i) => start / 2 ** i);
}

/**
 * Tiles of level `z` that intersect `extent`, computed like OpenLayers'
 * `TileGrid#getTileRangeForExtentAndZ`. `undefined` for a level the grid lacks.
 */
export function tileRangeAt(
  grid: MapGrid,
  extent: Extent,
  z: number,
): TileRange | undefined {
  if (!Number.isInteger(z) || z < 0 || z >= grid.resolutions.length) {
    return undefined;
  }
  const resolution = grid.resolutions[z];
  const [originX, originY] = grid.origins[z];
  const [tileWidth, tileHeight] = grid.tileSizes[z];
  const toX = (x: number) => (x - originX) / resolution / tileWidth;
  const toY = (y: number) => (originY - y) / resolution / tileHeight;
  return {
    minX: floor(toX(extent[0])),
    maxX: ceil(toX(extent[2])) - 1,
    minY: floor(toY(extent[3])),
    maxY: ceil(toY(extent[1])) - 1,
  };
}

export function isTileInGrid(
  grid: MapGrid,
  extent: Extent,
  { z, x, y }: TileCoord,
): boolean {
  const range = tileRangeAt(grid, extent, z);
  return (
    range !== undefined &&
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= range.minX &&
    x <= range.maxX &&
    y >= range.minY &&
    y <= range.maxY
  );
}

/**
 * Fills a tile URL template: `{z}`, `{x}`, `{y}`, `{-y}` (TMS row, `-y-1`)
 * and `{s}`. The subdomain is picked from the tile position, so one tile
 * always maps to one URL.
 */
export function expandTileUrl(
  template: string,
  { z, x, y }: TileCoord,
  subdomains: readonly string[] = [],
): string {
  const subdomain =
    subdomains.length > 0
      ? subdomains[Math.abs(x + y) % subdomains.length]
      : '';
  return template
    .replace(/\{z\}/g, String(z))
    .replace(/\{x\}/g, String(x))
    .replace(/\{-y\}/g, String(-y - 1))
    .replace(/\{y\}/g, String(y))
    .replace(/\{s\}/g, subdomain);
}

/** OpenLayers rounds to 5 decimals before flooring so float noise on tile edges is ignored. */
const DECIMALS = 5;

function round(n: number): number {
  const factor = 10 ** DECIMALS;
  return Math.round(n * factor) / factor;
}

function floor(n: number): number {
  return Math.floor(round(n));
}

function ceil(n: number): number {
  return Math.ceil(round(n));
}
