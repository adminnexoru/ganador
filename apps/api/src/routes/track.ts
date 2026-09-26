import { and, asc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { devices, positions } from '../db/schema';
import { AppError } from '../errors';
import { authenticate } from '../plugins/auth';
import { requirePetRole } from '../plugins/pet-access';

const DEFAULT_TZ = 'America/Mexico_City';

/** Fecha local (YYYY-MM-DD) en una zona horaria. */
function localDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export async function trackRoutes(app: FastifyInstance) {
  const deps = app.deps;

  // Recorrido de un día de los últimos 7 (FR-010), en la zona horaria del usuario.
  app.get<{ Params: { id: string }; Querystring: { date?: string; tz?: string } }>(
    '/pets/:id/track',
    { preHandler: authenticate(app) },
    async (req) => {
      await requirePetRole(deps, req.params.id, req.user.id, 'any');
      const q = z
        .object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          tz: z.string().max(64).default(DEFAULT_TZ),
        })
        .safeParse(req.query);
      if (!q.success) throw new AppError(400, 'date_out_of_range');
      const { date } = q.data;
      let tz = q.data.tz;
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
      } catch {
        tz = DEFAULT_TZ;
      }
      const today = localDate(deps.now(), tz);
      const oldest = localDate(new Date(deps.now().getTime() - 6 * 24 * 3600_000), tz);
      if (date > today || date < oldest) throw new AppError(400, 'date_out_of_range');

      const rows = await deps.db
        .select({ lat: positions.lat, lng: positions.lng, recordedAt: positions.recordedAt })
        .from(positions)
        .innerJoin(devices, eq(devices.id, positions.deviceId))
        .where(
          and(
            eq(devices.petId, req.params.id),
            eq(positions.valid, true),
            sql`(${positions.recordedAt} at time zone ${tz})::date = ${date}::date`,
          ),
        )
        .orderBy(asc(positions.recordedAt));
      return rows.map((r) => ({ lat: r.lat, lng: r.lng, recordedAt: r.recordedAt.toISOString() }));
    },
  );
}
