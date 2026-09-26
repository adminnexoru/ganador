import esMX from '@/i18n/locales/es-MX.json';

import type { PublicTag } from '@/api/types';

// Página pública de la placa como HTML armado en el servidor, sin JavaScript de la app
// (research R3, SC-003): el contacto aparece con la primera pintura de la página.
type Strings = typeof esMX.public & { privacyTitle: string };

const strings: Strings = { ...esMX.public, privacyTitle: esMX.privacy.title };

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const fill = (template: string, params: Record<string, string>) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => params[k] ?? '');

const CSS = `*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#F3F6FA;color:#11181C}
main{max-width:440px;margin:24px auto;padding:0 16px}.card{background:#fff;border-radius:16px;padding:24px;text-align:center}
img{width:160px;height:160px;border-radius:80px;object-fit:cover;background:#F3F6FA}h1{font-size:28px;margin:8px 0}
p{font-size:16px;line-height:1.4;margin:8px 0}.muted{color:#5B6670}.small{font-size:13px;color:#5B6670}
a.wa{display:block;margin:16px 0 8px;padding:16px;border-radius:14px;background:#1FAF55;color:#fff;font-size:18px;font-weight:700;text-decoration:none}
footer{text-align:center;margin:16px 0}footer a{color:#5B6670;font-size:14px}`;

function page(title: string, body: string, privacyUrl: string, extraHead = '') {
  return `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><style>${CSS}</style>${extraHead}</head><body><main><div class="card">${body}</div><footer><a href="${privacyUrl}">${escapeHtml(strings.privacyTitle)}</a></footer></main></body></html>`;
}

export type RenderOptions = { apiUrl: string; privacyUrl?: string; timingScript?: string };

/** HTML de la página pública; `tag` null = código inexistente, undefined = error de red. */
export function renderPublicPage(tag: PublicTag | null | undefined, opts: RenderOptions): string {
  const privacyUrl = opts.privacyUrl ?? '/aviso-de-privacidad';
  if (tag === undefined) return page(strings.inactiveTitle, `<p class="muted">${escapeHtml(strings.error)}</p>`, privacyUrl);
  if (tag === null || tag.status === 'inactive') {
    return page(
      strings.inactiveTitle,
      `<h1>${escapeHtml(strings.inactiveTitle)}</h1><p class="muted">${escapeHtml(strings.inactiveBody)}</p>`,
      privacyUrl,
    );
  }
  const name = escapeHtml(tag.pet.name);
  const parts: string[] = [];
  if (tag.pet.photoUrl) {
    const src = tag.pet.photoUrl.startsWith('http') ? tag.pet.photoUrl : `${opts.apiUrl}${tag.pet.photoUrl}`;
    parts.push(`<img src="${escapeHtml(src)}" alt="${escapeHtml(fill(strings.photoOf, { name: tag.pet.name }))}" width="160" height="160">`);
  }
  parts.push(`<p class="muted">${escapeHtml(tag.pet.species === 'cat' ? strings.foundCat : strings.foundDog)}</p>`);
  parts.push(`<h1>${name}</h1>`);
  if (tag.owner.name) parts.push(`<p>${escapeHtml(fill(strings.owner, { name: tag.owner.name }))}</p>`);
  if (tag.health?.conditions) parts.push(`<p>${escapeHtml(fill(strings.conditions, { text: tag.health.conditions }))}</p>`);
  if (tag.health?.medications) parts.push(`<p>${escapeHtml(fill(strings.medications, { text: tag.health.medications }))}</p>`);
  // Un solo botón de WhatsApp; sin llamada ni número visible (FR-023).
  parts.push(`<a class="wa" id="wa" href="${escapeHtml(tag.owner.whatsappUrl)}">${escapeHtml(strings.whatsapp)}</a>`);
  parts.push(`<p class="small">${escapeHtml(strings.noData)}</p>`);
  return page(tag.pet.name, parts.join(''), privacyUrl, opts.timingScript ?? '');
}
