/** `[minX, minY, maxX, maxY]` in a map's own projection units. */
export type Extent = [minX: number, minY: number, maxX: number, maxY: number];

/** `[x, y]` in a map's own projection units. */
export type GridOrigin = [x: number, y: number];

/** `[width, height]` in pixels. */
export type TileSize = [width: number, height: number];

/** Tile pyramid of a raster map; every array has one entry per zoom level. */
export interface MapGrid {
  /** Map units per pixel, largest (zoom 0) first. */
  resolutions: number[];
  origins: GridOrigin[];
  tileSizes: TileSize[];
}

/**
 * Normalized `.znc` map configuration. Tile coordinates follow OpenLayers:
 * `x` grows right and `y` grows down from the level's origin.
 */
export interface ZncConfig {
  name?: string;
  /** Tile image format, e.g. `png` or `jpg`. */
  format: string;
  /** Projection code, e.g. `EPSG:3857`. */
  epsg: string;
  /** proj4 definition of `epsg` when the projection is not built into OpenLayers. */
  proj4?: string;
  extent: Extent;
  grid: MapGrid;
  /**
   * Download URL template with `{z}`, `{x}`, `{y}`, `{-y}` (TMS row, `-y-1`)
   * and `{s}` (subdomain). Without it the map is served from its cache only.
   */
  tileUrl?: string;
  subdomains?: string[];
  /** Extra HTTP headers sent with every tile download. */
  headers: Record<string, string>;
}
