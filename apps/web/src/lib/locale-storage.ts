/**
 * Locale Storage Utilities
 *
 * Handles persistence of user's language preference across sessions.
 * Uses both cookie (for server-side access) and localStorage (for client-side reads).
 */

/**
 * Cookie name for locale storage.
 * This is the standard next-intl cookie name.
 */
export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

/**
 * LocalStorage key for backup/client-side access.
 */
export const LOCALE_STORAGE_KEY = 'preferred-locale';

/**
 * Cookie max age: 1 year in seconds.
 */
export const MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Supported locales type.
 */
export type SupportedLocale = 'en' | 'lt';

/**
 * Validate a locale string.
 */
function isValidLocale(locale: string | null | undefined): locale is SupportedLocale {
  return locale === 'en' || locale === 'lt';
}

/**
 * Get the stored locale preference.
 * Checks cookie first (set by middleware), then localStorage.
 *
 * @returns The stored locale or null if not set
 */
export function getStoredLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // Check cookie first
  const cookieValue = getCookie(LOCALE_COOKIE_NAME);
  if (isValidLocale(cookieValue)) {
    return cookieValue;
  }

  // Fallback to localStorage
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isValidLocale(stored)) {
      return stored;
    }
  } catch {
    // localStorage may be unavailable (private browsing, etc.)
  }

  return null;
}

/**
 * Set the locale preference in both cookie and localStorage.
 *
 * @param locale - The locale to store
 */
export function setStoredLocale(locale: SupportedLocale): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Set cookie with max-age and path
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;

  // Also set in localStorage for quick client-side access
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * Clear the stored locale preference from both cookie and localStorage.
 */
export function clearStoredLocale(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Clear cookie by setting expired date
  document.cookie = `${LOCALE_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;

  // Clear localStorage
  try {
    localStorage.removeItem(LOCALE_STORAGE_KEY);
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * Get a cookie value by name.
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === name) {
      return cookieValue || null;
    }
  }
  return null;
}
