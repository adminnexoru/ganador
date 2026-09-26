import { api } from './client';
import type { Location, Pet, PetInput } from './types';

export const listPets = () => api<Pet[]>('/pets');
export const getPet = (id: string) => api<Pet>(`/pets/${id}`);
export const createPet = (body: PetInput) => api<Pet>('/pets', { method: 'POST', body });
export const updatePet = (id: string, body: Partial<PetInput>) => api<Pet>(`/pets/${id}`, { method: 'PATCH', body });
export const deletePet = (id: string) => api<void>(`/pets/${id}`, { method: 'DELETE' });
export const getLocation = (id: string) => api<Location | null>(`/pets/${id}/location`);

export async function uploadPhoto(id: string, uri: string) {
  const form = new FormData();
  // React Native acepta { uri, name, type } como archivo en FormData.
  form.append('file', { uri, name: 'foto.jpg', type: 'image/jpeg' } as unknown as Blob);
  return api<Pet>(`/pets/${id}/photo`, { method: 'PUT', form });
}

export const getDevice = (id: string) =>
  api<{ id: string; externalId: string; profile: string } | null>(`/pets/${id}/device`);
export const linkDevice = (id: string, externalId: string) =>
  api(`/pets/${id}/device`, { method: 'POST', body: { externalId } });
export const unlinkDevice = (id: string) => api<void>(`/pets/${id}/device`, { method: 'DELETE' });
