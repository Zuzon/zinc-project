import type { Extent, MapGrid } from './zncConfig.js';

/** A map the backend can serve tiles for. */
export interface MapInfo {
  id: string;
  name: string;
  /** Grid extent in the map's projection units (not WGS84). */
  bbox: Extent;
  /** Smallest map units per pixel (most detailed level). */
  minResolution: number;
  /** Largest map units per pixel (level 0). */
  maxResolution: number;
  epsg: string;
  proj4?: string;
  format: string;
  grid: MapGrid;
  /** Tile URL template with `{z}`, `{x}` and `{y}` in OpenLayers tile coordinates. */
  tileUrl: string;
}
