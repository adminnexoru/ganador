import { readFileSync } from 'node:fs';

const cache = new Map<string, string>();

/** Texto del aviso de privacidad vigente (versionado en privacy/notices/<locale>/<versión>.md). */
export function privacyNoticeText(version: string, locale = 'es-MX'): string {
  const key = `${locale}/${version}`;
  if (!cache.has(key)) {
    const url = new URL(`./notices/${locale}/${version}.md`, import.meta.url);
    cache.set(key, readFileSync(url, 'utf8'));
  }
  return cache.get(key)!;
}
