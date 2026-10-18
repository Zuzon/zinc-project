import { FastifyInstance } from 'fastify';
import { webDir } from '../webDir';

export default async function (fastify: FastifyInstance) {
  // With a UI bundle, `/` is its index.html (plugins/web.ts).
  if (webDir()) {
    return;
  }
  fastify.get('/', async function () {
    return { message: 'Hello API' };
  });
}
