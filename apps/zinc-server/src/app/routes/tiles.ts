import { FastifyInstance } from 'fastify';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';

interface TileParams {
  mapId: string;
  z: string;
  x: string;
  y: string;
}

/** Tile coordinates are OpenLayers tile coords, so `y` can be negative. */
const INTEGER = /^-?\d+$/;

export default async function (fastify: FastifyInstance) {
  fastify.get<{ Params: TileParams }>(
    '/api/maps/:mapId/tiles/:z/:x/:y',
    async (request, reply) => {
      const { mapId, z, x, y } = request.params;
      if (![z, x, y].every((n) => INTEGER.test(n))) {
        return reply.code(400).header('cache-control', 'no-store').send();
      }

      let tile;
      try {
        tile = await firstValueFrom(
          fastify.maps
            .getTile(mapId, Number(z), Number(x), Number(y))
            // A client that gives up cancels the cache lookup and download.
            .pipe(takeUntil(fromEvent(reply.raw, 'close'))),
          { defaultValue: null },
        );
      } catch (err) {
        request.log.warn({ err }, 'tile unavailable');
        return reply.code(502).header('cache-control', 'no-store').send();
      }

      if (!tile) {
        // Not cached and not downloadable now; try again later, e.g. once online.
        return reply.code(404).header('cache-control', 'no-store').send();
      }
      return reply
        .header('content-type', tile.contentType)
        .header('cache-control', 'public, max-age=86400')
        .send(
          Buffer.from(
            tile.data.buffer,
            tile.data.byteOffset,
            tile.data.byteLength,
          ),
        );
    },
  );
}
