import type { ReactNode } from 'react';

import { NextIntlClientProvider } from 'next-intl';

// Import English messages for tests
import messages from '../../messages/en.json';

/**
 * Test wrapper for components that use next-intl translations.
 *
 * Provides the NextIntlClientProvider with English messages
 * for consistent test behavior.
 *
 * @example
 * import { render } from '@testing-library/react';
 * import { TestI18nProvider } from '@/test-utils/i18n';
 *
 * render(
 *   <TestI18nProvider>
 *     <MyComponent />
 *   </TestI18nProvider>
 * );
 */
export function TestI18nProvider({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * Test wrapper with Lithuanian locale.
 * Useful for testing locale-specific behavior.
 *
 * @example
 * import { render } from '@testing-library/react';
 * import { TestI18nProviderLt } from '@/test-utils/i18n';
 *
 * render(
 *   <TestI18nProviderLt>
 *     <MyComponent />
 *   </TestI18nProviderLt>
 * );
 */
export async function TestI18nProviderLt({ children }: { children: ReactNode }) {
  const ltMessages = await import('../../messages/lt.json');
  return (
    <NextIntlClientProvider locale="lt" messages={ltMessages.default}>
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * Helper to create a custom test provider with specific messages.
 *
 * @example
 * const CustomProvider = createTestI18nProvider({
 *   common: { save: 'Custom Save' }
 * });
 *
 * render(
 *   <CustomProvider>
 *     <MyComponent />
 *   </CustomProvider>
 * );
 */
export function createTestI18nProvider(
  customMessages: Partial<typeof messages>,
  locale: 'en' | 'lt' = 'en'
) {
  const mergedMessages = { ...messages, ...customMessages };

  return function CustomTestI18nProvider({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={mergedMessages}>
        {children}
      </NextIntlClientProvider>
    );
  };
}
