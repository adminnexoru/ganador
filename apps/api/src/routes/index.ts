import type { FastifyInstance } from 'fastify';

import { authRoutes } from './auth';
import { meRoutes } from './me';
import { petRoutes } from './pets';
import { publicRoutes } from './public';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(
    async (v1) => {
      await authRoutes(v1);
      await meRoutes(v1);
      await petRoutes(v1);
    },
    { prefix: '/v1' },
  );
  await app.register(publicRoutes, { prefix: '/public' });
}
