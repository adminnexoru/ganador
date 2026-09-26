import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { telemetryTimings } from '../db/schema';
import { AppError } from '../errors';
import { OriginLimiter } from '../plugins/public-rate-limit';
import { bucketFor } from '../services/timings';

const Body = z.object({
  metric: z.enum(['owner_map_visible', 'public_contact_visible']),
  ms: z.number().int().min(0).max(120_000),
  platform: z.enum(['ios', 'android', 'web']),
});

/**
 * Medición anónima de tiempos (research R17, SC-001, SC-003): sin autenticación ni
 * identificadores, sin registrar IP; se guarda como conteo diario por rango.
 */
export async function telemetryRoutes(app: FastifyInstance) {
  const { deps } = app;
  const limiter = new OriginLimiter({
    limit: 60,
    windowMs: 60_000,
    rotateMs: 24 * 3600_000,
    now: () => deps.now().getTime(),
  });

  app.post('/telemetry/timings', async (req, reply) => {
    const hit = limiter.hit(req.ip);
    if (!hit.allowed) throw new AppError(429, 'rate_limited', {}, { 'Retry-After': String(hit.retryAfterS) });
    // sendBeacon envía texto plano: se acepta JSON como texto o como objeto.
    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { metric, ms, platform } = Body.parse(raw);
    const day = deps.now().toISOString().slice(0, 10);
    await deps.db
      .insert(telemetryTimings)
      .values({ day, metric, platform, bucketMs: bucketFor(ms), count: 1 })
      .onConflictDoUpdate({
        target: [telemetryTimings.day, telemetryTimings.metric, telemetryTimings.platform, telemetryTimings.bucketMs],
        set: { count: sql`${telemetryTimings.count} + 1` },
      });
    return reply.status(204).send();
  });
}
