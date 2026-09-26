import type { PublicTag } from '@/api/types';
import { renderPublicPage } from '@/public-page/render';

// Ruta de servidor de la página pública (HU2, research R3): consulta la API y responde HTML
// ya armado, sin sesión ni JavaScript de la app. Reenvía la IP del visitante solo para el
// límite por origen en memoria de la API (research R16); aquí no se registra ni guarda.
const API_URL = (process.env.API_INTERNAL_URL ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const PUBLIC_API_URL = (process.env.EXPO_PUBLIC_API_URL ?? API_URL).replace(/\/$/, '');

export async function GET(request: Request, { code }: Record<string, string>) {
  let tag: PublicTag | null | undefined;
  try {
    const forwarded = request.headers.get('x-forwarded-for');
    const res = await fetch(`${API_URL}/public/tags/${encodeURIComponent(code ?? '')}`, {
      headers: forwarded ? { 'X-Forwarded-For': forwarded } : {},
    });
    if (res.status === 404) tag = null;
    else if (res.ok) tag = (await res.json()) as PublicTag;
    else tag = undefined;
  } catch {
    tag = undefined;
  }
  const status = tag === null ? 404 : tag === undefined ? 503 : 200;
  return new Response(renderPublicPage(tag, { apiUrl: PUBLIC_API_URL, telemetry: true }), {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
