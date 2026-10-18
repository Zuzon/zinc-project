import { EMPTY, firstValueFrom, of, throwError } from 'rxjs';
import type { TileData } from '@zinc-project/dto';
import {
  type TileSource,
  parseTilePath,
  tileResponse,
  tileUrlTemplate,
} from './tileResponse.js';

const tile: TileData = {
  data: new Uint8Array([1, 2, 3]),
  contentType: 'image/png',
};

const source = (getTile: TileSource['getTile']): TileSource => ({ getTile });

describe('tileUrlTemplate / parseTilePath', () => {
  it('round-trips map ids and negative tile rows', () => {
    const path = tileUrlTemplate('a b/c')
      .replace('{z}', '3')
      .replace('{x}', '4')
      .replace('{y}', '-5');
    expect(parseTilePath(path)).toEqual({
      mapId: 'a b/c',
      z: '3',
      x: '4',
      y: '-5',
    });
  });

  it('rejects other paths', () => {
    expect(parseTilePath('/index.html')).toBeNull();
    expect(parseTilePath('/api/maps/m/tiles/1/2')).toBeNull();
    expect(parseTilePath('/api/maps/%E0%A4%A/tiles/1/2/3')).toBeNull();
  });
});

describe('tileResponse', () => {
  const request = { mapId: 'm', z: '1', x: '0', y: '-1' };

  it('serves a found tile with a long cache lifetime', async () => {
    const calls: unknown[][] = [];
    const response = await firstValueFrom(
      tileResponse(
        source((...args: unknown[]) => {
          calls.push(args);
          return of(tile);
        }),
        request,
      ),
    );
    expect(calls).toEqual([['m', 1, 0, -1]]);
    expect(response).toEqual({
      status: 200,
      cacheControl: 'public, max-age=86400',
      contentType: 'image/png',
      body: tile.data,
    });
  });

  it('rejects non-integer coordinates without a lookup', async () => {
    const response = await firstValueFrom(
      tileResponse(
        source(() => {
          throw new Error('not called');
        }),
        { ...request, z: '1.5' },
      ),
    );
    expect(response).toEqual({ status: 400, cacheControl: 'no-store' });
  });

  it('answers 404 for a missing or empty tile', async () => {
    for (const result of [of(null), EMPTY]) {
      const response = await firstValueFrom(
        tileResponse(
          source(() => result),
          request,
        ),
      );
      expect(response).toEqual({ status: 404, cacheControl: 'no-store' });
    }
  });

  it('answers 502 with the cause when the lookup fails', async () => {
    const error = new Error('offline');
    const response = await firstValueFrom(
      tileResponse(
        source(() => throwError(() => error)),
        request,
      ),
    );
    expect(response).toEqual({ status: 502, cacheControl: 'no-store', error });
  });
});
