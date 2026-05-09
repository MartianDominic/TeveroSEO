'use client';

import { useEffect } from 'react';

import { useLocale } from 'next-intl';

import { setStoredLocale, type SupportedLocale } from '@/lib/locale-storage';

/**
 * Hook to sync locale changes to localStorage.
 *
 * This hook ensures that when the locale changes (via URL or middleware),
 * the change is persisted to localStorage for quick client-side access.
 *
 * Note: Cookie sync is handled by setStoredLocale when user explicitly
 * changes language via LanguageSwitcher. This hook handles syncs from
 * URL navigation or middleware detection.
 */
export function useLocaleSync(): void {
  const locale = useLocale() as SupportedLocale;

  useEffect(() => {
    // Sync current locale to localStorage
    // This ensures localStorage stays in sync even if locale is set via URL
    if (locale === 'en' || locale === 'lt') {
      setStoredLocale(locale);
    }
  }, [locale]);
}

export default useLocaleSync;
