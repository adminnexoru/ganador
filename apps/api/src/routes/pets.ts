import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { devices, petAccess, pets, publicProfileSettings, tags } from '../db/schema';
import { AppError, notFound } from '../errors';
import { authenticate } from '../plugins/auth';
import { requirePetRole } from '../plugins/pet-access';
import { getLocation } from '../services/location';
import { deletePetPhoto, publicPhotoPath, savePetPhoto } from '../services/photos';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

// Restricciones de data-model.md: name "1–40 caracteres, obligatorio", breed "≤ 60",
// conditions y medications "≤ 500".
const PetBody = z.object({
  name: z.string().trim().min(1).max(40),
  species: z.enum(['dog', 'cat']),
  breed: optionalText(60),
  size: z.enum(['small', 'medium', 'large']).nullable().optional(),
  conditions: optionalText(500),
  medications: optionalText(500),
});

export function serializePet(p: typeof pets.$inferSelect, role: string) {
  return {
    id: p.id,
    name: p.name,
    species: p.species,
    breed: p.breed,
    size: p.size,
    conditions: p.conditions,
    medications: p.medications,
    photoUrl: publicPhotoPath(p.photoKey),
    role,
  };
}

export async function petRoutes(app: FastifyInstance) {
  const auth = { preHandler: authenticate(app) };
  const deps = app.deps;

  app.get('/pets', auth, async (req) => {
    const rows = await deps.db
      .select({ pet: pets, role: petAccess.role })
      .from(petAccess)
      .innerJoin(pets, eq(pets.id, petAccess.petId))
      .where(and(eq(petAccess.ownerId, req.user.id), eq(petAccess.status, 'active')))
      .orderBy(pets.createdAt);
    return Promise.all(
      rows.map(async ({ pet, role }) => ({
        ...serializePet(pet, role),
        location: await getLocation(deps, pet.id),
      })),
    );
  });

  app.post('/pets', auth, async (req, reply) => {
    const body = PetBody.parse(req.body);
    const pet = await deps.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(pets)
        .values({ ...body, ownerId: req.user.id, createdAt: deps.now() })
        .returning();
      await tx
        .insert(petAccess)
        .values({ petId: created!.id, ownerId: req.user.id, role: 'owner', status: 'active' });
      await tx.insert(publicProfileSettings).values({ petId: created!.id });
      return created!;
    });
    return reply.status(201).send(serializePet(pet, 'owner'));
  });

  app.get<{ Params: { id: string } }>('/pets/:id', auth, async (req) => {
    const role = await requirePetRole(deps, req.params.id, req.user.id, 'any');
    const [pet] = await deps.db.select().from(pets).where(eq(pets.id, req.params.id));
    if (!pet) throw notFound();
    return serializePet(pet, role);
  });

  app.patch<{ Params: { id: string } }>('/pets/:id', auth, async (req) => {
    await requirePetRole(deps, req.params.id, req.user.id, 'owner');
    const body = PetBody.partial().parse(req.body);
    const [pet] = await deps.db.update(pets).set(body).where(eq(pets.id, req.params.id)).returning();
    return serializePet(pet!, 'owner');
  });

  app.delete<{ Params: { id: string } }>('/pets/:id', auth, async (req, reply) => {
    await requirePetRole(deps, req.params.id, req.user.id, 'owner');
    const [pet] = await deps.db.select().from(pets).where(eq(pets.id, req.params.id));
    await deps.db.transaction(async (tx) => {
      await tx.update(tags).set({ status: 'disabled', petId: null }).where(eq(tags.petId, req.params.id));
      await tx.update(devices).set({ status: 'unlinked', petId: null }).where(eq(devices.petId, req.params.id));
      await tx.delete(pets).where(eq(pets.id, req.params.id));
    });
    await deletePetPhoto(deps, pet?.photoKey ?? null);
    return reply.status(204).send();
  });

  app.put<{ Params: { id: string } }>('/pets/:id/photo', auth, async (req) => {
    await requirePetRole(deps, req.params.id, req.user.id, 'owner');
    const file = await req.file();
    if (!file) throw new AppError(400, 'unsupported_image');
    const buffer = await file.toBuffer();
    const [current] = await deps.db.select().from(pets).where(eq(pets.id, req.params.id));
    const key = await savePetPhoto(deps, req.params.id, buffer);
    const [pet] = await deps.db.update(pets).set({ photoKey: key }).where(eq(pets.id, req.params.id)).returning();
    await deletePetPhoto(deps, current?.photoKey ?? null);
    return serializePet(pet!, 'owner');
  });
}
