import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { owners, pets, publicProfileSettings, tags, tagViews } from '../db/schema';
import { notFound } from '../errors';
import { t } from '../i18n';
import { createPublicLimits } from '../plugins/public-rate-limit';
import { publicPhotoPath } from '../services/photos';
import { normalizeTagCode } from '../services/tag-codes';

/**
 * Rutas sin autenticación (contracts/public-api.md). No leen ni registran IP, agente de
 * usuario ni ubicación de quien consulta (FR-024a); la IP solo pasa por el límite en memoria.
 */
export async function publicRoutes(app: FastifyInstance) {
  const { deps } = app;
  const limits = createPublicLimits(() => deps.now().getTime());

  app.get<{ Params: { code: string } }>('/tags/:code', async (req, reply) => {
    limits.checkOrigin(req);
    const code = normalizeTagCode(req.params.code);
    if (!code) throw notFound();
    limits.checkCode(code);
    void reply.header('Cache-Control', 'no-store');

    const [row] = await deps.db
      .select({ tag: tags, pet: pets, owner: owners, settings: publicProfileSettings })
      .from(tags)
      .leftJoin(pets, eq(pets.id, tags.petId))
      .leftJoin(owners, eq(owners.id, pets.ownerId))
      .leftJoin(publicProfileSettings, eq(publicProfileSettings.petId, pets.id))
      .where(eq(tags.code, code));
    if (!row) throw notFound();
    const { tag, pet, owner, settings } = row;
    if (tag.status !== 'active' || !pet || !owner || owner.deletedAt) return { status: 'inactive' };

    await deps.db.insert(tagViews).values({ tagId: tag.id, viewedAt: deps.now() });
    await deps.queue.send('tag-view-notify', { tagId: tag.id });

    const text = t('whatsapp.public_message', { pet: pet.name }, owner.locale);
    const health: { conditions?: string; medications?: string } = {};
    if (settings?.showConditions && pet.conditions) health.conditions = pet.conditions;
    if (settings?.showMedications && pet.medications) health.medications = pet.medications;
    return {
      status: 'active',
      pet: { name: pet.name, species: pet.species, photoUrl: publicPhotoPath(pet.photoKey) },
      owner: {
        ...((settings?.showOwnerName ?? true) && owner.displayName ? { name: owner.displayName } : {}),
        // El número va solo dentro del enlace; no se envía como campo aparte (FR-023).
        whatsappUrl: `https://wa.me/${owner.phoneE164.replace('+', '')}?text=${encodeURIComponent(text)}`,
      },
      ...(Object.keys(health).length > 0 ? { health } : {}),
    };
  });

  app.get<{ Params: { petId: string; file: string } }>('/photos/:petId/:file', async (req, reply) => {
    const m = req.params.file.match(/^([A-Za-z0-9_-]+)\.webp$/);
    if (!m || !/^[0-9a-f-]{36}$/i.test(req.params.petId)) return reply.status(404).send();
    const obj = await deps.storage.get(`pets/${req.params.petId}/${m[1]}/public.webp`);
    if (!obj) return reply.status(404).send();
    return reply
      .header('Content-Type', obj.contentType)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(obj.body);
  });
}
