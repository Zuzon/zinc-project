import type { ZncConfig } from '@zinc-project/dto';
import { defaultResolutions } from '@zinc-project/utils';

const HALF_WORLD = 20037508.342789244;
const resolutions = defaultResolutions(
  [-HALF_WORLD, -HALF_WORLD, HALF_WORLD, HALF_WORLD],
  256,
  20,
);

/**
 * OpenStreetMap standard tiles. The tile usage policy asks for an honest
 * User-Agent: https://operations.osmfoundation.org/policies/tiles/
 */
export const OSM_MAP: ZncConfig = {
  name: 'OpenStreetMap',
  format: 'png',
  epsg: 'EPSG:3857',
  extent: [-HALF_WORLD, -HALF_WORLD, HALF_WORLD, HALF_WORLD],
  grid: {
    resolutions,
    origins: resolutions.map(() => [-HALF_WORLD, HALF_WORLD]),
    tileSizes: resolutions.map(() => [256, 256]),
  },
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  headers: {
    'User-Agent': 'Zinc/0.0.1 (+https://github.com/Zuzon/zinc-project)',
  },
};
