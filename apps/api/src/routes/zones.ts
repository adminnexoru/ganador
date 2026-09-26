import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { safeZones } from '../db/schema';
import { notFound } from '../errors';
import { authenticate } from '../plugins/auth';
import { requirePetRole } from '../plugins/pet-access';

// Restricciones de data-model.md: name "1–40", radiusM "50–2,000".
const ZoneBody = z.object({
  name: z.string().trim().min(1).max(40),
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(50).max(2000),
  active: z.boolean().optional(),
});

const serialize = (z: typeof safeZones.$inferSelect) => ({
  id: z.id,
  name: z.name,
  centerLat: z.centerLat,
  centerLng: z.centerLng,
  radiusM: z.radiusM,
  active: z.active,
});

export async function zoneRoutes(app: FastifyInstance) {
  const auth = { preHandler: authenticate(app) };
  const deps = app.deps;

  async function zoneForOwner(zoneId: string, ownerId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(zoneId)) throw notFound();
    const [zone] = await deps.db.select().from(safeZones).where(eq(safeZones.id, zoneId));
    if (!zone) throw notFound();
    await requirePetRole(deps, zone.petId, ownerId, 'owner');
    return zone;
  }

  app.get<{ Params: { id: string } }>('/pets/:id/zones', auth, async (req) => {
    await requirePetRole(deps, req.params.id, req.user.id, 'any');
    const rows = await deps.db.select().from(safeZones).where(eq(safeZones.petId, req.params.id));
    return rows.map(serialize);
  });

  app.post<{ Params: { id: string } }>('/pets/:id/zones', auth, async (req, reply) => {
    await requirePetRole(deps, req.params.id, req.user.id, 'owner');
    const body = ZoneBody.parse(req.body);
    const [zone] = await deps.db
      .insert(safeZones)
      .values({ ...body, petId: req.params.id })
      .returning();
    return reply.status(201).send(serialize(zone!));
  });

  app.patch<{ Params: { zoneId: string } }>('/zones/:zoneId', auth, async (req) => {
    await zoneForOwner(req.params.zoneId, req.user.id);
    const body = ZoneBody.partial().parse(req.body);
    const [zone] = await deps.db.update(safeZones).set(body).where(eq(safeZones.id, req.params.zoneId)).returning();
    return serialize(zone!);
  });

  app.delete<{ Params: { zoneId: string } }>('/zones/:zoneId', auth, async (req, reply) => {
    await zoneForOwner(req.params.zoneId, req.user.id);
    await deps.db.delete(safeZones).where(eq(safeZones.id, req.params.zoneId));
    return reply.status(204).send();
  });
}
