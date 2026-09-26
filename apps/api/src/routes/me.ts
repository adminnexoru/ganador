import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  devices,
  owners,
  petAccess,
  pets,
  positions,
  privacyConsents,
  publicProfileSettings,
  pushTokens,
  safeZones,
  tags,
} from '../db/schema';
import { AppError } from '../errors';
import { authenticate } from '../plugins/auth';
import { privacyNoticeText } from '../privacy';
import { revokeAllSessions } from '../services/sessions';

export async function loadUser(app: FastifyInstance, ownerId: string) {
  const [owner] = await app.deps.db.select().from(owners).where(eq(owners.id, ownerId));
  if (!owner) throw new AppError(401, 'unauthorized');
  return owner;
}

export function serializeUser(o: typeof owners.$inferSelect) {
  return {
    id: o.id,
    phone: o.phoneE164,
    displayName: o.displayName,
    whatsappAlertsEnabled: o.whatsappAlertsEnabled,
    whatsappConfirmed: o.whatsappConfirmed,
    locale: o.locale,
  };
}

const PatchMe = z
  .object({
    displayName: z.string().trim().min(1).max(60),
    whatsappAlertsEnabled: z.boolean(),
    whatsappConfirmed: z.literal(true),
  })
  .partial()
  .strict();

export async function meRoutes(app: FastifyInstance) {
  const auth = authenticate(app);
  const pre = { preHandler: auth, config: { skipConsent: true } };

  app.get('/privacy-notice', async () => {
    const version = app.deps.config.PRIVACY_NOTICE_VERSION;
    return {
      version,
      url: `${app.deps.config.PUBLIC_WEB_URL}/aviso-de-privacidad`,
      text: privacyNoticeText(version),
    };
  });

  app.post('/me/consent', pre, async (req, reply) => {
    const { noticeVersion } = z.object({ noticeVersion: z.string() }).parse(req.body);
    if (noticeVersion !== app.deps.config.PRIVACY_NOTICE_VERSION) {
      throw new AppError(409, 'notice_version_mismatch');
    }
    await app.deps.db
      .insert(privacyConsents)
      .values({ ownerId: req.user.id, noticeVersion, acceptedAt: app.deps.now() });
    return reply.status(204).send();
  });

  app.get('/me', pre, async (req) => serializeUser(req.user));

  app.patch('/me', pre, async (req) => {
    const body = PatchMe.parse(req.body);
    const update: Partial<typeof owners.$inferInsert> = {};
    if (body.displayName !== undefined) update.displayName = body.displayName;
    if (body.whatsappConfirmed) update.whatsappConfirmed = true;
    if (body.whatsappAlertsEnabled !== undefined) {
      // Aceptación expresa (FR-013a): se registra la fecha y se limpia al desactivar.
      update.whatsappAlertsEnabled = body.whatsappAlertsEnabled;
      update.whatsappOptInAt = body.whatsappAlertsEnabled ? app.deps.now() : null;
    }
    if (Object.keys(update).length > 0) {
      await app.deps.db.update(owners).set(update).where(eq(owners.id, req.user.id));
    }
    return serializeUser(await loadUser(app, req.user.id));
  });

  app.post('/me/push-tokens', pre, async (req, reply) => {
    const body = z
      .object({ token: z.string().min(10).max(200), platform: z.enum(['ios', 'android']) })
      .parse(req.body);
    await app.deps.db
      .insert(pushTokens)
      .values({ ...body, ownerId: req.user.id, lastUsedAt: app.deps.now() })
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: { ownerId: req.user.id, platform: body.platform, lastUsedAt: app.deps.now() },
      });
    return reply.status(204).send();
  });

  // Derecho de acceso (FR-003a): solo datos del usuario y de las mascotas de las que es dueño.
  app.get('/me/export', pre, async (req) => {
    const db = app.deps.db;
    const consents = await db
      .select({
        noticeVersion: privacyConsents.noticeVersion,
        acceptedAt: privacyConsents.acceptedAt,
        revokedAt: privacyConsents.revokedAt,
      })
      .from(privacyConsents)
      .where(eq(privacyConsents.ownerId, req.user.id));
    const ownPets = await db.select().from(pets).where(eq(pets.ownerId, req.user.id));
    const petIds = ownPets.map((p) => p.id);
    const none = petIds.length === 0;
    const [zones, devs, accesses, settings, petTags] = none
      ? [[], [], [], [], []]
      : await Promise.all([
          db.select().from(safeZones).where(inArray(safeZones.petId, petIds)),
          db.select().from(devices).where(inArray(devices.petId, petIds)),
          db
            .select({
              petId: petAccess.petId,
              role: petAccess.role,
              status: petAccess.status,
              invitedPhone: petAccess.invitedPhoneE164,
            })
            .from(petAccess)
            .where(inArray(petAccess.petId, petIds)),
          db.select().from(publicProfileSettings).where(inArray(publicProfileSettings.petId, petIds)),
          db
            .select({ petId: tags.petId, code: tags.code, status: tags.status })
            .from(tags)
            .where(inArray(tags.petId, petIds)),
        ]);
    const deviceIds = devs.map((d) => d.id);
    const since = new Date(app.deps.now().getTime() - 7 * 24 * 60 * 60 * 1000);
    const pos =
      deviceIds.length === 0
        ? []
        : await db
            .select({
              deviceId: positions.deviceId,
              recordedAt: positions.recordedAt,
              lat: positions.lat,
              lng: positions.lng,
            })
            .from(positions)
            .where(and(inArray(positions.deviceId, deviceIds), gt(positions.recordedAt, since)));
    return {
      exportedAt: app.deps.now().toISOString(),
      account: {
        ...serializeUser(req.user),
        whatsappOptInAt: req.user.whatsappOptInAt,
        createdAt: req.user.createdAt,
      },
      consents,
      pets: ownPets.map((p) => ({
        ...p,
        zones: zones.filter((z) => z.petId === p.id),
        device: devs.find((d) => d.petId === p.id) ?? null,
        accesses: accesses.filter((a) => a.petId === p.id),
        publicProfile: settings.find((s) => s.petId === p.id) ?? null,
        tags: petTags.filter((t) => t.petId === p.id),
        positions: pos.filter((x) => devs.find((d) => d.id === x.deviceId)?.petId === p.id),
      })),
    };
  });

  // Cancelación (FR-003): cierra sesiones de inmediato y borra datos en segundo plano (≤ 24 h).
  app.delete('/me', pre, async (req, reply) => {
    await app.deps.db
      .update(owners)
      .set({ deletedAt: app.deps.now() })
      .where(and(eq(owners.id, req.user.id), isNull(owners.deletedAt)));
    await revokeAllSessions(app.deps, req.user.id);
    await app.deps.queue.send('delete-account', { ownerId: req.user.id });
    return reply.status(202).send();
  });
}
