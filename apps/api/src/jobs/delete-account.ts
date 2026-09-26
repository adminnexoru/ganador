import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import {
  devices,
  owners,
  petAccess,
  pets,
  privacyConsents,
  pushTokens,
  sessions,
  tags,
} from '../db/schema';
import type { Deps } from '../deps';

/**
 * Borra los datos personales de una cuenta (FR-003, ≤ 24 h). Conserva solo la fila anónima
 * del dueño con sus constancias de consentimiento, marcadas como revocadas.
 */
export async function deleteAccount(deps: Deps, { ownerId }: { ownerId: string }) {
  const now = deps.now();
  await deps.db.transaction(async (tx) => {
    const [owner] = await tx.select().from(owners).where(eq(owners.id, ownerId));
    if (!owner) return;
    const ownPets = await tx.select().from(pets).where(eq(pets.ownerId, ownerId));
    const petIds = ownPets.map((p) => p.id);

    if (petIds.length > 0) {
      // Las placas dejan de mostrar datos y los rastreadores quedan libres.
      await tx.update(tags).set({ status: 'disabled', petId: null }).where(inArray(tags.petId, petIds));
      await tx
        .update(devices)
        .set({ status: 'unlinked', petId: null })
        .where(inArray(devices.petId, petIds));
      await tx.delete(pets).where(inArray(pets.id, petIds));
    }
    for (const p of ownPets) {
      if (p.photoKey) {
        await deps.storage.delete(p.photoKey);
        await deps.storage.delete(publicPhotoKey(p.photoKey));
      }
    }

    // Accesos como familiar e invitaciones pendientes a su número.
    await tx
      .delete(petAccess)
      .where(or(eq(petAccess.ownerId, ownerId), eq(petAccess.invitedPhoneE164, owner.phoneE164)));
    await tx.delete(sessions).where(eq(sessions.ownerId, ownerId));
    await tx.delete(pushTokens).where(eq(pushTokens.ownerId, ownerId));
    await tx
      .update(privacyConsents)
      .set({ revokedAt: now })
      .where(and(eq(privacyConsents.ownerId, ownerId), isNull(privacyConsents.revokedAt)));
    await tx
      .update(owners)
      .set({
        phoneE164: `deleted:${ownerId}`,
        displayName: '',
        whatsappAlertsEnabled: false,
        whatsappOptInAt: null,
        whatsappConfirmed: false,
        deletedAt: owner.deletedAt ?? now,
      })
      .where(eq(owners.id, ownerId));
  });
}

export function publicPhotoKey(photoKey: string) {
  return photoKey.replace(/original\.jpg$/, 'public.webp');
}
