import { defineRouting } from 'next-intl/routing';

/**
 * Centralized routing configuration for next-intl.
 * Used by both middleware and navigation helpers.
 */
export const routing = defineRouting({
  // Supported locales - English and Lithuanian
  locales: ['en', 'lt'],

  // Default locale - English (no prefix)
  defaultLocale: 'en',

  // Locale prefix strategy:
  // - 'as-needed': No prefix for default locale (en), /lt/ prefix for Lithuanian
  localePrefix: 'as-needed',

  // Enable locale detection from Accept-Language header
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];
