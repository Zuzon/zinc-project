import fastifyStatic from '@fastify/static';
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { webDir } from '../webDir';

/** Serves the zinc-web UI bundle when `ZINC_WEB_DIR` points at one. */
export default fp(
  async function web(fastify: FastifyInstance) {
    const root = webDir();
    if (!root) {
      return;
    }
    fastify.log.info({ root }, 'serving zinc-web');
    await fastify.register(fastifyStatic, { root });
  },
  { name: 'web' },
);
