import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { publicProfileSettings, tags } from '../db/schema';
import { AppError, notFound } from '../errors';
import { authenticate } from '../plugins/auth';
import { requirePetRole } from '../plugins/pet-access';
import { normalizeTagCode } from '../services/tag-codes';

const serializeTag = (t: typeof tags.$inferSelect) => ({ id: t.id, code: t.code, status: t.status });

export async function tagRoutes(app: FastifyInstance) {
  const auth = { preHandler: authenticate(app) };
  const deps = app.deps;

  app.get<{ Params: { id: string } }>('/pets/:id/tags', auth, async (req) => {
    await requirePetRole(deps, req.params.id, req.user.id, 'owner');
    const rows = await deps.db
      .select()
      .from(tags)
      .where(and(eq(tags.petId, req.params.id), eq(tags.status, 'active')));
    return rows.map(serializeTag);
  });

  // Activa una placa (FR-019): inactive|disabled → active.
  app.post<{ Params: { id: string } }>('/pets/:id/tags', auth, async (req, reply) => {
    await requirePetRole(deps, req.params.id, req.user.id, 'owner');
    const { code: raw } = z.object({ code: z.string().max(200) }).parse(req.body);
    // El número del dueño se usa en el botón de WhatsApp de la página pública (FR-023).
    if (!req.user.whatsappConfirmed) throw new AppError(409, 'whatsapp_not_confirmed');
    const code = normalizeTagCode(raw);
    if (!code) throw notFound();
    const [tag] = await deps.db.select().from(tags).where(eq(tags.code, code));
    if (!tag) throw notFound();
    if (tag.status === 'active' && tag.petId !== req.params.id) throw new AppError(409, 'tag_already_active');
    const [updated] = await deps.db
      .update(tags)
      .set({ status: 'active', petId: req.params.id, activatedAt: deps.now() })
      .where(eq(tags.id, tag.id))
      .returning();
    return reply.status(201).send(serializeTag(updated!));
  });

  // Desvincula o reporta perdida: active → disabled.
  app.delete<{ Params: { tagId: string } }>('/tags/:tagId', auth, async (req, reply) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.tagId)) throw notFound();
    const [tag] = await deps.db.select().from(tags).where(eq(tags.id, req.params.tagId));
    if (!tag?.petId) throw notFound();
    await requirePetRole(deps, tag.petId, req.user.id, 'owner');
    await deps.db.update(tags).set({ status: 'disabled', petId: null }).where(eq(tags.id, tag.id));
    return reply.status(204).send();
  });

  const Settings = z
    .object({ showOwnerName: z.boolean(), showConditions: z.boolean(), showMedications: z.boolean() })
    .strict();

  app.get<{ Params: { id: string } }>('/pets/:id/public-profile', auth, async (req) => {
    await requirePetRole(deps, req.params.id, req.user.id, 'owner');
    const [row] = await deps.db
      .select()
      .from(publicProfileSettings)
      .where(eq(publicProfileSettings.petId, req.params.id));
    return {
      showOwnerName: row?.showOwnerName ?? true,
      showConditions: row?.showConditions ?? false,
      showMedications: row?.showMedications ?? false,
    };
  });

  app.put<{ Params: { id: string } }>('/pets/:id/public-profile', auth, async (req) => {
    await requirePetRole(deps, req.params.id, req.user.id, 'owner');
    const body = Settings.parse(req.body);
    await deps.db
      .insert(publicProfileSettings)
      .values({ petId: req.params.id, ...body })
      .onConflictDoUpdate({ target: publicProfileSettings.petId, set: body });
    return body;
  });
}
