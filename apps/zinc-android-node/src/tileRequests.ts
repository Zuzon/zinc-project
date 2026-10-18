import type { IncomingMessage, ServerResponse } from 'node:http';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import {
  type TileSource,
  parseTilePath,
  tileResponse,
} from '@zinc-project/backend';
import { hasToken } from './access.js';

/** HTTP handler of the loopback server: map tiles only, token required. */
export function tileRequestHandler(tiles: TileSource, token: string) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    void serve(tiles, token, req, res).catch((err) => {
      console.error('[backend] tile request failed', err);
      if (!res.headersSent) {
        res.writeHead(500);
      }
      res.end();
    });
  };
}

async function serve(
  tiles: TileSource,
  token: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (!hasToken(req.url, token)) {
    res.writeHead(403).end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end();
    return;
  }
  const params = parseTilePath(
    new URL(req.url ?? '/', 'http://loopback').pathname,
  );
  if (!params) {
    res.writeHead(404).end();
    return;
  }
  const response = await firstValueFrom(
    tileResponse(tiles, params).pipe(
      // A cancelled image request cancels the cache lookup and download.
      takeUntil(fromEvent(res, 'close')),
    ),
    { defaultValue: null },
  );
  if (!response) {
    return;
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
  res.writeHead(response.status, headers);
  res.end(req.method === 'HEAD' ? undefined : response.body);
}
