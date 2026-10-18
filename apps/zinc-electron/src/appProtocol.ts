import { join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import {
  type TileSource,
  parseTilePath,
  tileResponse,
} from '@zinc-project/backend';

/** The renderer is served from `zinc://app/`, never from `file://`. */
export const APP_SCHEME = 'zinc';
export const APP_HOST = 'app';
export const APP_URL = `${APP_SCHEME}://${APP_HOST}/index.html`;

// OpenLayers sets inline styles; tiles and the worker load from the app itself.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
].join('; ');

/** Must run before the app is ready. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

export function isAppUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === `${APP_SCHEME}:` && parsed.host === APP_HOST;
  } catch {
    return false;
  }
}

/** Serves the bundled UI from `rendererDir` and map tiles from `tiles`. */
export function handleAppProtocol(
  tiles: TileSource,
  rendererDir: string,
): void {
  const root = normalize(rendererDir);
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) {
      return new Response(null, { status: 404 });
    }
    const tile = parseTilePath(url.pathname);
    return tile
      ? serveTile(tiles, tile, request)
      : serveFile(root, url.pathname);
  });
}

async function serveTile(
  tiles: TileSource,
  params: NonNullable<ReturnType<typeof parseTilePath>>,
  request: Request,
): Promise<Response> {
  const response = await firstValueFrom(
    tileResponse(tiles, params).pipe(
      // A cancelled image request cancels the cache lookup and download.
      takeUntil(fromEvent(request.signal, 'abort')),
    ),
    { defaultValue: null },
  );
  if (!response) {
    return new Response(null, { status: 499 });
  }
  if (response.error) {
    console.warn('[tiles] tile unavailable', response.error);
  }
  const headers: Record<string, string> = {
    'cache-control': response.cacheControl,
  };
  if (response.contentType) {
    headers['content-type'] = response.contentType;
  }
  // A copy is ArrayBuffer-backed, as BodyInit requires; tiles are a few KB.
  const body = response.body ? new Uint8Array(response.body) : null;
  return new Response(body, {
    status: response.status,
    headers,
  });
}

async function serveFile(root: string, pathname: string): Promise<Response> {
  let relative: string;
  try {
    relative = decodeURIComponent(pathname);
  } catch {
    return new Response(null, { status: 400 });
  }
  const file = normalize(
    join(root, relative === '/' ? 'index.html' : relative),
  );
  if (!file.startsWith(root + sep)) {
    return new Response(null, { status: 403 });
  }
  let response: Response;
  try {
    response = await net.fetch(pathToFileURL(file).toString());
  } catch {
    return new Response(null, { status: 404 });
  }
  const headers = new Headers(response.headers);
  headers.set('content-security-policy', CSP);
  return new Response(response.body, { status: response.status, headers });
}
