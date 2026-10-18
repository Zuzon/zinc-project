import { FastifyInstance } from 'fastify';
import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';
import { type TilePathParams, tileResponse } from '@zinc-project/backend';

export default async function (fastify: FastifyInstance) {
  fastify.get<{ Params: TilePathParams }>(
    '/api/maps/:mapId/tiles/:z/:x/:y',
    async (request, reply) => {
      const response = await firstValueFrom(
        tileResponse(fastify.maps, request.params).pipe(
          // A client that gives up cancels the cache lookup and download.
          takeUntil(fromEvent(reply.raw, 'close')),
        ),
        { defaultValue: null },
      );
      if (!response) {
        return reply.code(499).send();
      }
      if (response.error) {
        request.log.warn({ err: response.error }, 'tile unavailable');
      }
      reply
        .code(response.status)
        .header('cache-control', response.cacheControl);
      if (!response.body) {
        return reply.send();
      }
      return reply
        .header('content-type', response.contentType)
        .send(
          Buffer.from(
            response.body.buffer,
            response.body.byteOffset,
            response.body.byteLength,
          ),
        );
    },
  );
}
