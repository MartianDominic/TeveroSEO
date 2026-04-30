/**
 * Language Resolution Utility
 *
 * Implements the language resolution order defined in Phase 55 DESIGN.md:
 * 1. Explicit user choice (language switcher in UI)
 * 2. Prospect/Client preference (for outbound communications)
 * 3. Workspace default
 * 4. Browser Accept-Language header
 * 5. Platform default (en)
 */

/**
 * Supported locales in the platform.
 */
export type SupportedLocale = 'en' | 'lt';

/**
 * Formality level for translations.
 * Lithuanian uses formal (jūs) vs informal (tu).
 */
export type Formality = 'formal' | 'informal';

/**
 * Source of the resolved language.
 * Useful for debugging and analytics.
 */
export type LanguageSource =
  | 'user_selection'
  | 'prospect_preference'
  | 'workspace_default'
  | 'accept_language'
  | 'platform_default';

/**
 * Context for language resolution.
 * Provides all possible sources for language preference.
 */
export interface LanguageContext {
  /** Explicit user selection from language switcher */
  userSelection?: SupportedLocale | null;
  /** Prospect or client's preferred language */
  prospectLanguage?: SupportedLocale | null;
  /** Workspace default language */
  workspaceDefault?: SupportedLocale | null;
  /** Browser Accept-Language header value */
  acceptLanguage?: string | null;
  /** Workspace formality setting */
  workspaceFormality?: Formality | null;
}

/**
 * Result of language resolution.
 */
export interface ResolvedLanguage {
  /** The resolved locale */
  locale: SupportedLocale;
  /** Formality level for translations */
  formality: Formality;
  /** Which source determined the language */
  source: LanguageSource;
}

/**
 * List of supported locales for validation.
 */
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'lt'] as const;

/**
 * Default platform locale.
 */
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * Default formality level.
 */
export const DEFAULT_FORMALITY: Formality = 'formal';

/**
 * Check if a locale is supported.
 */
export function isValidLocale(locale: string | undefined | null): locale is SupportedLocale {
  return !!locale && SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

/**
 * Parse Accept-Language header and return supported locales in preference order.
 *
 * @example
 * parseAcceptLanguage('lt-LT,lt;q=0.9,en-US;q=0.8,en;q=0.7')
 * // Returns: ['lt', 'en']
 */
export function parseAcceptLanguage(header: string | null | undefined): SupportedLocale[] {
  if (!header) {
    return [];
  }

  // Parse Accept-Language header format: "lt-LT,lt;q=0.9,en-US;q=0.8,en;q=0.7"
  const languages = header
    .split(',')
    .map((part) => {
      const [lang, qPart] = part.trim().split(';');
      const q = qPart ? parseFloat(qPart.replace('q=', '')) : 1;
      // Extract just the language code (e.g., 'lt' from 'lt-LT')
      const langCode = lang.split('-')[0].toLowerCase();
      return { langCode, q };
    })
    .sort((a, b) => b.q - a.q) // Sort by quality factor descending
    .map(({ langCode }) => langCode);

  // Filter to only supported locales, maintaining order
  return languages.filter((lang): lang is SupportedLocale =>
    SUPPORTED_LOCALES.includes(lang as SupportedLocale)
  );
}

/**
 * Resolve language based on context using the defined priority order.
 *
 * Resolution order:
 * 1. User selection (explicit language switcher choice)
 * 2. Prospect language (for outbound communications)
 * 3. Workspace default
 * 4. Accept-Language header
 * 5. Platform default (en)
 *
 * @example
 * // User has selected Lithuanian
 * resolveLanguage({ userSelection: 'lt' })
 * // Returns: { locale: 'lt', formality: 'formal', source: 'user_selection' }
 *
 * @example
 * // No explicit selection, but prospect prefers Lithuanian
 * resolveLanguage({ prospectLanguage: 'lt', workspaceDefault: 'en' })
 * // Returns: { locale: 'lt', formality: 'formal', source: 'prospect_preference' }
 */
export function resolveLanguage(context: LanguageContext): ResolvedLanguage {
  const formality = context.workspaceFormality ?? DEFAULT_FORMALITY;

  // 1. Explicit user choice (language switcher in UI)
  if (isValidLocale(context.userSelection)) {
    return {
      locale: context.userSelection,
      formality,
      source: 'user_selection',
    };
  }

  // 2. Prospect/Client preference (for outbound communications)
  if (isValidLocale(context.prospectLanguage)) {
    return {
      locale: context.prospectLanguage,
      formality,
      source: 'prospect_preference',
    };
  }

  // 3. Workspace default
  if (isValidLocale(context.workspaceDefault)) {
    return {
      locale: context.workspaceDefault,
      formality,
      source: 'workspace_default',
    };
  }

  // 4. Browser Accept-Language header
  const acceptLanguages = parseAcceptLanguage(context.acceptLanguage);
  if (acceptLanguages.length > 0) {
    return {
      locale: acceptLanguages[0],
      formality,
      source: 'accept_language',
    };
  }

  // 5. Platform default
  return {
    locale: DEFAULT_LOCALE,
    formality,
    source: 'platform_default',
  };
}

/**
 * Resolve language for a prospect's communication.
 * Convenience wrapper that only considers prospect-relevant sources.
 */
export function resolveProspectLanguage(
  prospectLanguage: SupportedLocale | null | undefined,
  workspaceDefault: SupportedLocale | null | undefined,
  workspaceFormality?: Formality
): ResolvedLanguage {
  return resolveLanguage({
    prospectLanguage,
    workspaceDefault,
    workspaceFormality,
  });
}
