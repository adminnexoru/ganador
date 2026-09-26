import { and, eq } from 'drizzle-orm';

import { petAccess } from '../db/schema';
import type { Deps } from '../deps';
import { AppError, notFound } from '../errors';

export type PetRole = 'owner' | 'family';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPetRole(deps: Deps, petId: string, ownerId: string): Promise<PetRole | null> {
  if (!UUID.test(petId)) return null;
  const [row] = await deps.db
    .select({ role: petAccess.role })
    .from(petAccess)
    .where(and(eq(petAccess.petId, petId), eq(petAccess.ownerId, ownerId), eq(petAccess.status, 'active')));
  return row?.role ?? null;
}

/**
 * Permisos por mascota (FR-018): 'owner' para endpoints marcados O en contracts/app-api.md,
 * 'any' para los marcados F. Sin acceso → 404 (no revela que la mascota existe);
 * familiar en endpoint de dueño → 403 forbidden.
 */
export async function requirePetRole(
  deps: Deps,
  petId: string,
  ownerId: string,
  need: 'owner' | 'any',
): Promise<PetRole> {
  const role = await getPetRole(deps, petId, ownerId);
  if (!role) throw notFound();
  if (need === 'owner' && role !== 'owner') throw new AppError(403, 'forbidden');
  return role;
}
