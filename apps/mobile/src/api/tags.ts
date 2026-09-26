import { api } from './client';
import type { PublicProfileSettings, Tag, User } from './types';

export const listTags = (petId: string) => api<Tag[]>(`/pets/${petId}/tags`);
export const activateTag = (petId: string, code: string) =>
  api<Tag>(`/pets/${petId}/tags`, { method: 'POST', body: { code } });
export const disableTag = (tagId: string) => api<void>(`/tags/${tagId}`, { method: 'DELETE' });

export const getPublicProfile = (petId: string) => api<PublicProfileSettings>(`/pets/${petId}/public-profile`);
export const savePublicProfile = (petId: string, body: PublicProfileSettings) =>
  api<PublicProfileSettings>(`/pets/${petId}/public-profile`, { method: 'PUT', body });

export const getMe = () => api<User>('/me');
export const patchMe = (body: Partial<Pick<User, 'displayName' | 'whatsappAlertsEnabled'>> & { whatsappConfirmed?: true }) =>
  api<User>('/me', { method: 'PATCH', body });
