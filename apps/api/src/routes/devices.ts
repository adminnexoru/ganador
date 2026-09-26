import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { PROFILES } from '../adapters/traccar/profiles';
import { devices, pets } from '../db/schema';
import { AppError } from '../errors';
import { authenticate } from '../plugins/auth';
import { requirePetRole } from '../plugins/pet-access';
import { getLocation } from '../services/location';

export async function deviceRoutes(app: FastifyInstance) {
  const auth = { preHandler: authenticate(app) };
  const deps = app.deps;

  // Vincula un rastreador (FR-006): 409 si ya está en otra mascota; lo registra en Traccar,
  // que en producción rechaza dispositivos desconocidos (constitución v1.1.0).
  app.post<{ Params: { id: string } }>('/pets/:id/device', auth, async (req, reply) => {
    await requirePetRole(deps, req.params.id, req.user.id, 'owner');
    const { externalId } = z
      .object({ externalId: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/) })
      .parse(req.body);

    const [existing] = await deps.db
      .select()
      .from(devices)
      .where(and(eq(devices.source, 'traccar'), eq(devices.externalId, externalId)));
    if (existing?.status === 'linked' && existing.petId !== req.params.id) {
      throw new AppError(409, 'device_already_linked');
    }
    const [current] = await deps.db
      .select()
      .from(devices)
      .where(and(eq(devices.petId, req.params.id), eq(devices.status, 'linked')));
    if (current && current.externalId !== externalId) throw new AppError(409, 'pet_already_has_device');

    const [pet] = await deps.db.select({ name: pets.name }).from(pets).where(eq(pets.id, req.params.id));
    await deps.traccar.createDevice(externalId, pet!.name);

    const generic = PROFILES.generic!;
    const values = {
      petId: req.params.id,
      status: 'linked' as const,
      activity: null,
      activitySince: null,
      lastSeenAt: null,
      batteryAlertArmed: true,
      signalAlertArmed: true,
    };
    const [device] = existing
      ? await deps.db.update(devices).set(values).where(eq(devices.id, existing.id)).returning()
      : await deps.db
          .insert(devices)
          .values({
            source: 'traccar',
            externalId,
            profile: generic.name,
            restIntervalS: generic.restIntervalS,
            ...values,
          })
          .returning();
    return reply.status(201).send({ id: device!.id, externalId: device!.externalId, profile: device!.profile });
  });

  app.delete<{ Params: { id: string } }>('/pets/:id/device', auth, async (req, reply) => {
    await requirePetRole(deps, req.params.id, req.user.id, 'owner');
    await deps.db
      .update(devices)
      .set({ status: 'unlinked', petId: null })
      .where(eq(devices.petId, req.params.id));
    return reply.status(204).send();
  });

  app.get<{ Params: { id: string } }>('/pets/:id/device', auth, async (req) => {
    await requirePetRole(deps, req.params.id, req.user.id, 'any');
    const [device] = await deps.db
      .select({ id: devices.id, externalId: devices.externalId, profile: devices.profile })
      .from(devices)
      .where(and(eq(devices.petId, req.params.id), eq(devices.status, 'linked')));
    return device ?? null;
  });

  // Ubicación, batería y estado (FR-008, FR-009).
  app.get<{ Params: { id: string } }>('/pets/:id/location', auth, async (req, reply) => {
    await requirePetRole(deps, req.params.id, req.user.id, 'any');
    const location = await getLocation(deps, req.params.id);
    return reply.header('Cache-Control', 'no-store').type('application/json').send(JSON.stringify(location));
  });
}
