import type { MapInfo } from '@zinc-project/dto';
import { createMapSource, resolveMapProjection, tileUrl } from './mapSource.js';

const HALF = 20037508.342789244;
const osm: MapInfo = {
  id: 'osm',
  name: 'OSM',
  bbox: [-HALF, -HALF, HALF, HALF],
  minResolution: 156543.03392804097 / 2,
  maxResolution: 156543.03392804097,
  epsg: 'EPSG:3857',
  format: 'png',
  grid: {
    resolutions: [156543.03392804097, 156543.03392804097 / 2],
    origins: [
      [-HALF, HALF],
      [-HALF, HALF],
    ],
    tileSizes: [
      [256, 256],
      [256, 256],
    ],
  },
  tileUrl: '/api/maps/osm/tiles/{z}/{x}/{y}',
};

/** Latvian LKS-92 / TM, a projection OpenLayers does not know by itself. */
const lks92: MapInfo = {
  ...osm,
  id: 'lks',
  epsg: 'EPSG:3059',
  proj4:
    '+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9996 +x_0=500000 +y_0=-6000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  bbox: [300000, 160000, 780000, 450000],
  grid: {
    resolutions: [1000, 500],
    origins: [
      [300000, 450000],
      [300000, 450000],
    ],
    tileSizes: [
      [256, 256],
      [256, 256],
    ],
  },
};

describe('tileUrl', () => {
  it('fills the template with raw tile coordinates', () => {
    expect(tileUrl('/t/{z}/{x}/{y}', 2, 3, -1)).toBe('/t/2/3/-1');
  });
});

describe('resolveMapProjection', () => {
  it('returns a projection OpenLayers already knows', () => {
    expect(resolveMapProjection(osm)?.getCode()).toBe('EPSG:3857');
  });

  it('registers a proj4 projection and gives it the map extent', () => {
    const projection = resolveMapProjection(lks92);
    expect(projection?.getCode()).toBe('EPSG:3059');
    expect(projection?.getExtent()).toEqual(lks92.bbox);
  });

  it('returns null for an unknown projection without a definition', () => {
    expect(resolveMapProjection({ ...osm, epsg: 'EPSG:999999' })).toBeNull();
  });
});

describe('createMapSource', () => {
  it('uses the map grid and the maps service URL', () => {
    const projection = resolveMapProjection(osm);
    if (!projection) {
      throw new Error('EPSG:3857 must be known');
    }
    const source = createMapSource(osm, projection);
    const grid = source.getTileGrid();

    expect(source.getProjection()?.getCode()).toBe('EPSG:3857');
    expect(grid?.getResolutions()).toEqual(osm.grid.resolutions);
    expect(grid?.getOrigin(1)).toEqual([-HALF, HALF]);
    expect(source.getTileUrlFunction()([1, 1, 0], 1, projection)).toBe(
      '/api/maps/osm/tiles/1/1/0',
    );
  });
});
