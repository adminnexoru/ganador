import { and, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { owners, petAccess, pets, pushTokens } from '../db/schema';
import { AppError, notFound } from '../errors';
import { t } from '../i18n';
import { authenticate } from '../plugins/auth';
import { requirePetRole } from '../plugins/pet-access';
import { normalizePhone } from '../services/auth';

export async function accessRoutes(app: FastifyInstance) {
  const auth = { preHandler: authenticate(app) };
  const deps = app.deps;
  const uuid = /^[0-9a-f-]{36}$/i;

  // Lista de accesos (solo dueño).
  app.get<{ Params: { id: string } }>('/pets/:id/access', auth, async (req) => {
    await requirePetRole(deps, req.params.id, req.user.id, 'owner');
    const rows = await deps.db
      .select({ a: petAccess, phone: owners.phoneE164, name: owners.displayName })
      .from(petAccess)
      .leftJoin(owners, eq(owners.id, petAccess.ownerId))
      .where(and(eq(petAccess.petId, req.params.id), inArray(petAccess.status, ['invited', 'active'])))
      .orderBy(petAccess.createdAt);
    return rows.map(({ a, phone, name }) => ({
      id: a.id,
      role: a.role,
      status: a.status,
      phone: a.invitedPhoneE164 ?? phone,
      displayName: name || null,
    }));
  });

  // Invitar por número de celular (FR-017).
  app.post<{ Params: { id: string } }>('/pets/:id/access', auth, async (req, reply) => {
    await requirePetRole(deps, req.params.id, req.user.id, 'owner');
    const phone = normalizePhone(z.object({ phone: z.string().max(20) }).parse(req.body).phone);
    if (phone === req.user.phoneE164) throw new AppError(400, 'cannot_invite_self');

    const [invitee] = await deps.db.select().from(owners).where(eq(owners.phoneE164, phone));
    const existing = await deps.db
      .select()
      .from(petAccess)
      .where(and(eq(petAccess.petId, req.params.id), inArray(petAccess.status, ['invited', 'active'])));
    const dup = existing.find((a) => a.invitedPhoneE164 === phone || (invitee && a.ownerId === invitee.id));
    const [row] = dup
      ? [dup]
      : await deps.db
          .insert(petAccess)
          .values({ petId: req.params.id, invitedPhoneE164: phone, role: 'family', status: 'invited', createdAt: deps.now() })
          .returning();

    if (invitee && !dup) {
      const [pet] = await deps.db.select({ name: pets.name }).from(pets).where(eq(pets.id, req.params.id));
      const tokens = await deps.db.select().from(pushTokens).where(eq(pushTokens.ownerId, invitee.id));
      await deps.push
        .send(
          tokens.map((tk) => ({
            to: tk.token,
            title: t('push.invitation.title', { pet: pet?.name ?? '' }, invitee.locale),
            body: t('push.invitation.body', {}, invitee.locale),
            data: { type: 'invitation', petId: req.params.id },
          })),
        )
        .catch(() => undefined);
    }
    return reply.status(201).send({ id: row!.id, role: row!.role, status: row!.status, phone, displayName: null });
  });

  // Revocar: efecto inmediato; el acceso del dueño no se revoca.
  app.delete<{ Params: { id: string; accessId: string } }>('/pets/:id/access/:accessId', auth, async (req, reply) => {
    await requirePetRole(deps, req.params.id, req.user.id, 'owner');
    if (!uuid.test(req.params.accessId)) throw notFound();
    const [row] = await deps.db
      .select()
      .from(petAccess)
      .where(and(eq(petAccess.id, req.params.accessId), eq(petAccess.petId, req.params.id)));
    if (!row) throw notFound();
    if (row.role === 'owner') throw new AppError(400, 'validation_error');
    await deps.db
      .update(petAccess)
      .set({ status: 'revoked', updatedAt: deps.now() })
      .where(eq(petAccess.id, row.id));
    return reply.status(204).send();
  });

  // Invitaciones pendientes para el número del usuario.
  app.get('/invitations', auth, async (req) => {
    const rows = await deps.db
      .select({ id: petAccess.id, petName: pets.name, ownerName: owners.displayName })
      .from(petAccess)
      .innerJoin(pets, eq(pets.id, petAccess.petId))
      .innerJoin(owners, eq(owners.id, pets.ownerId))
      .where(and(eq(petAccess.invitedPhoneE164, req.user.phoneE164), eq(petAccess.status, 'invited')));
    return rows.map((r) => ({ id: r.id, petName: r.petName, invitedBy: r.ownerName }));
  });

  app.post<{ Params: { accessId: string } }>('/invitations/:accessId/accept', auth, async (req, reply) => {
    if (!uuid.test(req.params.accessId)) throw notFound();
    const [updated] = await deps.db
      .update(petAccess)
      .set({ ownerId: req.user.id, status: 'active', invitedPhoneE164: null, updatedAt: deps.now() })
      .where(
        and(
          eq(petAccess.id, req.params.accessId),
          eq(petAccess.invitedPhoneE164, req.user.phoneE164),
          eq(petAccess.status, 'invited'),
        ),
      )
      .returning({ id: petAccess.id });
    if (!updated) throw new AppError(404, 'invitation_not_found');
    return reply.status(204).send();
  });
}
