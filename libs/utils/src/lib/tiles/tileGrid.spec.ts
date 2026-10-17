import type { Extent, MapGrid } from '@zinc-project/dto';
import {
  defaultResolutions,
  expandTileUrl,
  isTileInGrid,
  tileRangeAt,
} from './tileGrid.js';

const HALF = 20037508.342789244;
const mercator: Extent = [-HALF, -HALF, HALF, HALF];
const osmGrid = (origin: [number, number]): MapGrid => {
  const resolutions = defaultResolutions(mercator, 256, 20);
  return {
    resolutions,
    origins: resolutions.map(() => origin),
    tileSizes: resolutions.map(() => [256, 256]),
  };
};

describe('defaultResolutions', () => {
  it('starts at one tile across the extent and halves per level', () => {
    const res = defaultResolutions(mercator, 256);
    expect(res).toHaveLength(23);
    expect(res[0]).toBeCloseTo(156543.03392804097, 6);
    expect(res[1]).toBeCloseTo(res[0] / 2, 9);
  });
});

describe('tileRangeAt', () => {
  it('covers 2^z tiles per axis for a top-left origin', () => {
    const grid = osmGrid([-HALF, HALF]);
    expect(tileRangeAt(grid, mercator, 0)).toEqual({
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    });
    expect(tileRangeAt(grid, mercator, 3)).toEqual({
      minX: 0,
      maxX: 7,
      minY: 0,
      maxY: 7,
    });
  });

  it('gives negative rows for a bottom-left origin', () => {
    const grid = osmGrid([-HALF, -HALF]);
    expect(tileRangeAt(grid, mercator, 1)).toEqual({
      minX: 0,
      maxX: 1,
      minY: -2,
      maxY: -1,
    });
  });

  it('is undefined for levels the grid lacks', () => {
    const grid = osmGrid([-HALF, HALF]);
    expect(tileRangeAt(grid, mercator, -1)).toBeUndefined();
    expect(tileRangeAt(grid, mercator, 20)).toBeUndefined();
    expect(tileRangeAt(grid, mercator, 1.5)).toBeUndefined();
  });
});

describe('isTileInGrid', () => {
  const grid = osmGrid([-HALF, HALF]);

  it('accepts tiles inside the level', () => {
    expect(isTileInGrid(grid, mercator, { z: 2, x: 3, y: 3 })).toBe(true);
  });

  it('rejects tiles outside the level or with a bad zoom', () => {
    expect(isTileInGrid(grid, mercator, { z: 2, x: 4, y: 0 })).toBe(false);
    expect(isTileInGrid(grid, mercator, { z: 2, x: 0, y: -1 })).toBe(false);
    expect(isTileInGrid(grid, mercator, { z: 25, x: 0, y: 0 })).toBe(false);
  });
});

describe('expandTileUrl', () => {
  it('fills z, x, y and the TMS row', () => {
    expect(
      expandTileUrl('https://t/{z}/{x}/{y}/{-y}.png', { z: 3, x: 5, y: 2 }),
    ).toBe('https://t/3/5/2/-3.png');
  });

  it('maps a bottom-left grid row to the TMS row', () => {
    expect(expandTileUrl('{-y}', { z: 1, x: 0, y: -1 })).toBe('0');
  });

  it('picks a stable subdomain per tile', () => {
    const url = (x: number) =>
      expandTileUrl('https://{s}.t/{x}', { z: 1, x, y: 0 }, ['a', 'b', 'c']);
    expect(url(0)).toBe('https://a.t/0');
    expect(url(1)).toBe('https://b.t/1');
    expect(url(4)).toBe(url(4));
  });
});
