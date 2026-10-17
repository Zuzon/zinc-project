import { ZNC_INVALID_KEY, ZncParseError, parseZnc, writeZnc } from './znc.js';

const HALF = 20037508.342789244;

/** Built-in OSM map as exported by legacy shturmen-zinc. */
const legacyOsm = {
  tileExtension: 'png',
  cacheType: 'tms',
  cachePath: '',
  useProj: true,
  epsg: 'EPSG:3857',
  proj4:
    '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs',
  minX: -HALF,
  minY: -HALF,
  maxX: HALF,
  maxY: HALF,
  originX: -HALF,
  originY: HALF,
  tileWidth: 256,
  tileHeight: 256,
  useServer: true,
  tileScript:
    "resolve('https://tile.openstreetmap.org/'+z+'/'+x+'/'+(-y-1)+'.png');",
  requestHeaders: [{ key: 'Referer', value: 'https://www.openstreetmap.org/' }],
  useCustomResolutions: false,
  resolutions: [],
  useMultiOrigins: false,
  origins: [],
  useMultiTileSizes: false,
  tileSizes: [],
};

describe('parseZnc', () => {
  it('normalizes a legacy file and names it after the file', () => {
    const config = parseZnc(JSON.stringify(legacyOsm), '/maps/Open Street.znc');

    expect(config.name).toBe('Open Street');
    expect(config.format).toBe('png');
    expect(config.epsg).toBe('EPSG:3857');
    expect(config.proj4).toContain('+proj=merc');
    expect(config.extent).toEqual([-HALF, -HALF, HALF, HALF]);
    expect(config.grid.resolutions).toHaveLength(23);
    expect(config.grid.resolutions[0]).toBeCloseTo(156543.03392804097, 6);
    expect(config.grid.origins[5]).toEqual([-HALF, HALF]);
    expect(config.grid.tileSizes[5]).toEqual([256, 256]);
    expect(config.headers).toEqual({
      Referer: 'https://www.openstreetmap.org/',
    });
  });

  it('ignores the legacy tile script, leaving the map cache-only', () => {
    expect(parseZnc(JSON.stringify(legacyOsm)).tileUrl).toBeUndefined();
  });

  it('reads the download template and subdomains', () => {
    const config = parseZnc(
      JSON.stringify({
        ...legacyOsm,
        name: 'OSM',
        tileUrl: 'https://{s}.tile/{z}/{x}/{y}.png',
        subdomains: 'abc',
      }),
      'ignored.znc',
    );
    expect(config.name).toBe('OSM');
    expect(config.tileUrl).toBe('https://{s}.tile/{z}/{x}/{y}.png');
    expect(config.subdomains).toEqual(['a', 'b', 'c']);
  });

  it('sorts custom levels together with their origins and sizes', () => {
    const config = parseZnc(
      JSON.stringify({
        ...legacyOsm,
        useCustomResolutions: true,
        resolutions: [10, 40, 20],
        useMultiOrigins: true,
        origins: [
          [1, 1],
          [4, 4],
          [2, 2],
        ],
        useMultiTileSizes: true,
        tileSizes: [
          [256, 256],
          [512, 512],
          [256, 512],
        ],
      }),
    );
    expect(config.grid).toEqual({
      resolutions: [40, 20, 10],
      origins: [
        [4, 4],
        [2, 2],
        [1, 1],
      ],
      tileSizes: [
        [512, 512],
        [256, 512],
        [256, 256],
      ],
    });
  });

  it.each([
    ['not JSON', '{'],
    ['an array', '[]'],
    ['no extension', JSON.stringify({ ...legacyOsm, tileExtension: '' })],
    ['an inverted extent', JSON.stringify({ ...legacyOsm, minX: HALF })],
    [
      'origins not matching resolutions',
      JSON.stringify({
        ...legacyOsm,
        useCustomResolutions: true,
        resolutions: [2, 1],
        useMultiOrigins: true,
        origins: [[0, 0]],
      }),
    ],
  ])('rejects %s with the i18n key', (_, content) => {
    let error: unknown;
    try {
      parseZnc(content);
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(ZncParseError);
    expect((error as ZncParseError).key).toBe(ZNC_INVALID_KEY);
  });
});

describe('writeZnc', () => {
  it('round-trips through parseZnc', () => {
    const config = parseZnc(
      JSON.stringify({
        ...legacyOsm,
        name: 'OSM',
        tileUrl: 'https://tile/{z}/{x}/{y}.png',
      }),
    );
    expect(parseZnc(writeZnc(config))).toEqual(config);
  });
});
