import type { MapInfo, StoredMap } from '@zinc-project/dto';

/** Describes a stored map to clients; `tileUrl` is the host's tile endpoint for it. */
export function toMapInfo(map: StoredMap, tileUrl: string): MapInfo {
  const { config } = map;
  const { resolutions } = config.grid;
  return {
    id: map.id,
    name: map.name,
    bbox: config.extent,
    minResolution: resolutions[resolutions.length - 1],
    maxResolution: resolutions[0],
    epsg: config.epsg,
    ...(config.proj4 ? { proj4: config.proj4 } : {}),
    format: config.format,
    grid: config.grid,
    tileUrl,
  };
}
