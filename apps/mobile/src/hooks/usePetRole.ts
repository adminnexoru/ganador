import { getPet } from '@/api/pets';
import type { PetRole } from '@/api/types';

import { useQuery } from './use-query';

/**
 * Rol del usuario en la mascota. Los familiares solo ven (FR-018): las pantallas ocultan los
 * controles de edición cuando `canEdit` es falso. La API también lo impide (403).
 */
export function usePetRole(petId: string): { role: PetRole | null; canEdit: boolean; loading: boolean } {
  const { data, loading } = useQuery(() => getPet(petId), [petId]);
  const role = data?.role ?? null;
  return { role, canEdit: role === 'owner', loading };
}
