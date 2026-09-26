/** URL base de la API (EXPO_PUBLIC_API_URL; en desarrollo, la IP de la máquina en la LAN). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const absoluteUrl = (path: string | null | undefined) =>
  path ? (path.startsWith('http') ? path : `${API_URL}${path}`) : null;
