/**
 * useResponsiveTranslation Hook
 *
 * Provides translation functions that automatically try _short variants
 * on mobile and narrow viewports. Falls back to full translation if
 * short variant doesn't exist.
 */

"use client";

import { useTranslations } from "next-intl";
import { useMediaQuery } from "./useMediaQuery";

type TranslationValues = Record<string, string | number | boolean>;

interface ResponsiveTranslationResult {
  /**
   * Returns short variant on mobile/narrow, full translation otherwise
   */
  t: (key: string, values?: TranslationValues) => string;
  /**
   * Always returns full translation, ignoring viewport
   */
  tFull: (key: string, values?: TranslationValues) => string;
  /**
   * Always returns short variant if available, otherwise full
   */
  tShort: (key: string, values?: TranslationValues) => string;
  /**
   * Whether current viewport is mobile (<640px)
   */
  isMobile: boolean;
  /**
   * Whether current viewport is narrow (<1024px)
   */
  isNarrow: boolean;
}

/**
 * Hook for responsive translations with automatic short variant selection
 *
 * @param namespace - Optional translation namespace
 * @returns Translation functions and viewport state
 *
 * @example
 * ```tsx
 * const { t, isMobile } = useResponsiveTranslation("nav");
 * // On mobile, tries "dashboard_short" first, falls back to "dashboard"
 * return <span>{t("dashboard")}</span>;
 * ```
 */
export function useResponsiveTranslation(
  namespace?: string
): ResponsiveTranslationResult {
  const translations = useTranslations(namespace);
  const isMobile = useMediaQuery("(max-width: 639px)");
  const isNarrow = useMediaQuery("(max-width: 1023px)");

  /**
   * Try to get translation for a key, checking _short variant first if on mobile/narrow
   */
  const t = (key: string, values?: TranslationValues): string => {
    if (isMobile || isNarrow) {
      const shortKey = `${key}_short`;
      try {
        // Try short variant first
        const shortValue = translations(shortKey, values);
        // If it returns the key itself (missing translation), fall back to full
        if (shortValue !== shortKey) {
          return shortValue;
        }
      } catch {
        // Short variant doesn't exist, fall through to full
      }
    }

    return translations(key, values);
  };

  /**
   * Always return full translation
   */
  const tFull = (key: string, values?: TranslationValues): string => {
    return translations(key, values);
  };

  /**
   * Always try short variant first, regardless of viewport
   */
  const tShort = (key: string, values?: TranslationValues): string => {
    const shortKey = `${key}_short`;
    try {
      const shortValue = translations(shortKey, values);
      if (shortValue !== shortKey) {
        return shortValue;
      }
    } catch {
      // Short variant doesn't exist
    }
    return translations(key, values);
  };

  return {
    t,
    tFull,
    tShort,
    isMobile,
    isNarrow,
  };
}

export default useResponsiveTranslation;
