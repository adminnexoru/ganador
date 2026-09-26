import { api } from './client';
import type { Access, Invitation, TrackPoint } from './types';

export const getTrack = (petId: string, date: string) =>
  api<TrackPoint[]>(`/pets/${petId}/track?date=${date}&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`);

export const listAccess = (petId: string) => api<Access[]>(`/pets/${petId}/access`);
export const invite = (petId: string, phone: string) =>
  api<Access>(`/pets/${petId}/access`, { method: 'POST', body: { phone } });
export const revokeAccess = (petId: string, accessId: string) =>
  api<void>(`/pets/${petId}/access/${accessId}`, { method: 'DELETE' });
export const listInvitations = () => api<Invitation[]>('/invitations');
export const acceptInvitation = (id: string) => api<void>(`/invitations/${id}/accept`, { method: 'POST' });
