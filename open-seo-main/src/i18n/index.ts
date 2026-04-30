import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import lt from './locales/lt.json';

/**
 * i18next configuration for open-seo-main (TanStack Start).
 *
 * Language detection order:
 * 1. Cookie (NEXT_LOCALE for compatibility with apps/web)
 * 2. localStorage
 * 3. Browser navigator.language
 *
 * Supported locales: English (en), Lithuanian (lt)
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      lt: { translation: lt },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'lt'],
    interpolation: {
      // React already protects against XSS
      escapeValue: false,
    },
    detection: {
      // Detection order: cookie first (for sync with Next.js), then localStorage, then browser
      order: ['cookie', 'localStorage', 'navigator'],
      // Cookie name matches next-intl convention
      lookupCookie: 'NEXT_LOCALE',
      lookupLocalStorage: 'i18nextLng',
      // Cache user language choice
      caches: ['cookie', 'localStorage'],
      cookieMinutes: 60 * 24 * 365, // 1 year
    },
  });

export default i18n;
