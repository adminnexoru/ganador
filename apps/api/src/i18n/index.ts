import esMX from './es-MX.json' with { type: 'json' };

type Dict = { [k: string]: string | Dict };
const catalogs: Record<string, Dict> = { 'es-MX': esMX as Dict };

/** Traduce una clave con interpolación {{var}}; es-MX es el idioma base (principio IV). */
export function t(key: string, params: Record<string, string | number> = {}, locale = 'es-MX'): string {
  const dict = catalogs[locale] ?? catalogs['es-MX']!;
  const value = key.split('.').reduce<string | Dict | undefined>(
    (acc, part) => (typeof acc === 'object' ? acc[part] : undefined),
    dict,
  );
  const text = typeof value === 'string' ? value : key;
  return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? ''));
}

export function pickLocale(acceptLanguage: string | undefined): string {
  return acceptLanguage && catalogs[acceptLanguage.split(',')[0]!.trim()] ? acceptLanguage.split(',')[0]!.trim() : 'es-MX';
}

export function formatTime(date: Date, locale = 'es-MX', timeZone = 'America/Mexico_City'): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone }).format(date);
}
