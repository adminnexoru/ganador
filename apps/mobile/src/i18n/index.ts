import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import esMX from './locales/es-MX.json';

// es-MX es el idioma base y de respaldo (principio IV); el inglés queda preparado.
export const SUPPORTED_LOCALES = ['es-MX', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// El inglés no se habilita en el MVP.
const ENGLISH_ENABLED = false;

export function detectLocale(): SupportedLocale {
  const tag = getLocales()[0]?.languageTag ?? 'es-MX';
  return tag.startsWith('en') && ENGLISH_ENABLED ? 'en' : 'es-MX';
}

const i18n = createInstance();
void i18n.use(initReactI18next).init({
  resources: { 'es-MX': { translation: esMX }, en: { translation: en } },
  lng: detectLocale(),
  fallbackLng: 'es-MX',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
