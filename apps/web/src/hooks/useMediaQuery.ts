/**
 * useMediaQuery Hook
 *
 * SSR-safe media query hook that tracks viewport width changes.
 * Returns true if the query matches, false otherwise.
 */

import { useState, useEffect, useCallback } from "react";

/**
 * Hook to detect if a media query matches
 * @param query - CSS media query string (e.g., "(max-width: 768px)")
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  // Default to false for SSR - no window available
  const [matches, setMatches] = useState(false);

  const handleChange = useCallback((event: MediaQueryListEvent) => {
    setMatches(event.matches);
  }, []);

  useEffect(() => {
    // Skip on server
    if (typeof window === "undefined") {
      return;
    }

    const mediaQueryList = window.matchMedia(query);

    // Set initial value
    setMatches(mediaQueryList.matches);

    // Modern browsers support addEventListener
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener("change", handleChange);
      return () => {
        mediaQueryList.removeEventListener("change", handleChange);
      };
    }

    // Fallback for older browsers
    mediaQueryList.addListener(handleChange);
    return () => {
      mediaQueryList.removeListener(handleChange);
    };
  }, [query, handleChange]);

  return matches;
}

/**
 * Predefined breakpoint hooks for common use cases
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 639px)");
}

export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 640px) and (max-width: 1023px)");
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

export function useIsNarrow(): boolean {
  return useMediaQuery("(max-width: 1023px)");
}

export function useIsWide(): boolean {
  return useMediaQuery("(min-width: 1280px)");
}

export default useMediaQuery;
