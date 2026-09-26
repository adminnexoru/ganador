// Peticiones sin sesión (página pública y aviso). No importa el cliente autenticado para que
// la página pública no cargue almacenamiento seguro ni lógica de la app del dueño.
import { API_URL } from './config';
import type { PublicTag } from './types';

export type PrivacyNotice = { version: string; url: string; text: string };

export async function fetchPrivacyNotice(): Promise<PrivacyNotice> {
  const res = await fetch(`${API_URL}/v1/privacy-notice`);
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as PrivacyNotice;
}

export async function fetchPublicTag(code: string): Promise<PublicTag | null> {
  const res = await fetch(`${API_URL}/public/tags/${encodeURIComponent(code)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as PublicTag;
}
