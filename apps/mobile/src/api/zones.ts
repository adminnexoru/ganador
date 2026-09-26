import { api } from './client';
import type { Zone } from './types';

export type ZoneInput = Omit<Zone, 'id' | 'active'> & { active?: boolean };

export const listZones = (petId: string) => api<Zone[]>(`/pets/${petId}/zones`);
export const createZone = (petId: string, body: ZoneInput) =>
  api<Zone>(`/pets/${petId}/zones`, { method: 'POST', body });
export const updateZone = (zoneId: string, body: Partial<ZoneInput>) =>
  api<Zone>(`/zones/${zoneId}`, { method: 'PATCH', body });
export const deleteZone = (zoneId: string) => api<void>(`/zones/${zoneId}`, { method: 'DELETE' });
