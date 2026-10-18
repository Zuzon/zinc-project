import { Observable, catchError, defaultIfEmpty, map, of, take } from 'rxjs';
import type { MapsService } from './maps.service.js';

/** Raw path parameters of a tile request; validated by {@link tileResponse}. */
export interface TilePathParams {
  mapId: string;
  z: string;
  x: string;
  y: string;
}

/** A transport-neutral tile reply, mapped to HTTP or a protocol handler by the host. */
export interface TileResponse {
  status: 200 | 400 | 404 | 502;
  cacheControl: string;
  contentType?: string;
  body?: Uint8Array;
  /** Why the tile is unavailable (502), for logging. */
  error?: unknown;
}

export type TileSource = Pick<MapsService, 'getTile'>;

/** Tile coordinates are OpenLayers tile coords, so `y` can be negative. */
const INTEGER = /^-?\d+$/;
const TILE_PATH = /^\/api\/maps\/([^/]+)\/tiles\/([^/]+)\/([^/]+)\/([^/]+)$/;
const NO_STORE = 'no-store';

/** Tile URL template under which hosts serve a map's tiles (`MapsServiceOptions.tileUrl`). */
export function tileUrlTemplate(mapId: string): string {
  return `/api/maps/${encodeURIComponent(mapId)}/tiles/{z}/{x}/{y}`;
}

/** Parses a path built from {@link tileUrlTemplate}; `null` if it is not a tile path. */
export function parseTilePath(pathname: string): TilePathParams | null {
  const match = TILE_PATH.exec(pathname);
  if (!match) {
    return null;
  }
  try {
    return {
      mapId: decodeURIComponent(match[1]),
      z: match[2],
      x: match[3],
      y: match[4],
    };
  } catch {
    return null;
  }
}

/**
 * Looks up one tile and describes the reply. Unsubscribing cancels the
 * cache lookup and any download, e.g. when the client gives up.
 */
export function tileResponse(
  source: TileSource,
  { mapId, z, x, y }: TilePathParams,
): Observable<TileResponse> {
  if (![z, x, y].every((n) => INTEGER.test(n))) {
    return of({ status: 400, cacheControl: NO_STORE });
  }
  return source.getTile(mapId, Number(z), Number(x), Number(y)).pipe(
    take(1),
    defaultIfEmpty(null),
    map(
      (tile): TileResponse =>
        tile
          ? {
              status: 200,
              cacheControl: 'public, max-age=86400',
              contentType: tile.contentType,
              body: tile.data,
            }
          : // Not cached and not downloadable now; try again later, e.g. once online.
            { status: 404, cacheControl: NO_STORE },
    ),
    catchError((error: unknown) =>
      of<TileResponse>({ status: 502, cacheControl: NO_STORE, error }),
    ),
  );
}
