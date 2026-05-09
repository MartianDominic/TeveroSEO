'use client';

import * as React from 'react';
import { createContext, useContext, useMemo } from 'react';

import { useLocale } from 'next-intl';

import type { Formality } from '@/lib/language-resolution';
import type { SupportedLocale } from '@/lib/locale-storage';

/**
 * Language context value.
 */
export interface LanguageContextValue {
  /** Current locale code */
  currentLocale: SupportedLocale;
  /** Whether current locale is Lithuanian */
  isLithuanian: boolean;
  /** Formality level for translations */
  formality: Formality;
}

/**
 * Language context.
 */
const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Props for LanguageProvider.
 */
export interface LanguageProviderProps {
  children: React.ReactNode;
  /** Formality level (default: 'formal') */
  formality?: Formality;
}

/**
 * Language provider component.
 *
 * Provides language context to child components, including:
 * - Current locale
 * - Whether Lithuanian is active
 * - Formality level
 */
export function LanguageProvider({
  children,
  formality = 'formal',
}: LanguageProviderProps) {
  const locale = useLocale() as SupportedLocale;

  const value = useMemo<LanguageContextValue>(
    () => ({
      currentLocale: locale,
      isLithuanian: locale === 'lt',
      formality,
    }),
    [locale, formality]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook to access language context.
 *
 * @throws Error if used outside LanguageProvider
 */
export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }

  return context;
}

/**
 * Hook to access language context (optional).
 *
 * Returns null if used outside LanguageProvider instead of throwing.
 */
export function useLanguageOptional(): LanguageContextValue | null {
  return useContext(LanguageContext);
}

export { LanguageContext };
export default LanguageProvider;
