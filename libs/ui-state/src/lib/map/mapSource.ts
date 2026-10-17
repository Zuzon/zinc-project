import proj4 from 'proj4';
import { get as getProjection } from 'ol/proj.js';
import type Projection from 'ol/proj/Projection.js';
import { register } from 'ol/proj/proj4.js';
import TileImage from 'ol/source/TileImage.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';
import type { MapInfo } from '@zinc-project/dto';

/**
 * The map's projection, registering its proj4 definition first when
 * OpenLayers does not know it. `null` when the projection is unknown.
 */
export function resolveMapProjection(info: MapInfo): Projection | null {
  if (info.proj4 && !getProjection(info.epsg)) {
    proj4.defs(info.epsg, info.proj4);
    register(proj4);
  }
  const projection = getProjection(info.epsg);
  if (projection && !projection.getExtent()) {
    projection.setExtent(info.bbox);
  }
  return projection;
}

/** Tile source loading `info`'s tiles from the maps service URL template. */
export function createMapSource(
  info: MapInfo,
  projection: Projection,
): TileImage {
  return new TileImage({
    projection,
    tileGrid: new TileGrid({
      extent: info.bbox,
      origins: info.grid.origins,
      resolutions: info.grid.resolutions,
      tileSizes: info.grid.tileSizes,
    }),
    tileUrlFunction: ([z, x, y]) => tileUrl(info.tileUrl, z, x, y),
  });
}

/** Fills `{z}`, `{x}` and `{y}` with raw OpenLayers tile coordinates. */
export function tileUrl(
  template: string,
  z: number,
  x: number,
  y: number,
): string {
  return template
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}
