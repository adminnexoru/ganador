import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

/** Estado de la API, la base de datos y Traccar para el monitoreo externo (research R9). */
export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_req, reply) => {
    const [db, traccar] = await Promise.all([
      app.deps.db
        .execute(sql`select 1`)
        .then(() => true)
        .catch(() => false),
      app.deps.traccar.ping(),
    ]);
    const ok = db && traccar;
    return reply
      .status(ok ? 200 : 503)
      .header('Cache-Control', 'no-store')
      .send({ status: ok ? 'ok' : 'degraded', db: db ? 'ok' : 'down', traccar: traccar ? 'ok' : 'down' });
  });
}
