/**
 * useMediaQuery Hook
 * Phase 96: CPR-010
 *
 * Responsive design hook for detecting screen sizes.
 * Used by portal components for mobile-responsive layouts.
 *
 * Usage:
 * ```tsx
 * function ResponsiveComponent() {
 *   const isMobile = useMediaQuery('(max-width: 768px)');
 *
 *   return isMobile ? <MobileView /> : <DesktopView />;
 * }
 * ```
 */
import { useState, useEffect, useCallback } from "react";

/**
 * Preset breakpoints matching Tailwind CSS defaults.
 */
export const BREAKPOINTS = {
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
  "2xl": "(min-width: 1536px)",
} as const;

/**
 * Hook for matching media queries.
 *
 * @param query - CSS media query string (e.g., "(max-width: 768px)")
 * @returns Boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  // Initialize with a function to handle SSR
  const getMatches = useCallback((): boolean => {
    // Check if window is defined (SSR safety)
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia(query).matches;
  }, [query]);

  const [matches, setMatches] = useState<boolean>(getMatches);

  useEffect(() => {
    // SSR safety check
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(query);

    // Set initial value
    setMatches(mediaQuery.matches);

    // Handler for media query changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    // Legacy browsers (Safari < 14)
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [query]);

  return matches;
}

/**
 * Hook for common responsive breakpoints.
 * Returns object with boolean flags for each breakpoint.
 */
export function useResponsive() {
  const isSm = useMediaQuery(BREAKPOINTS.sm);
  const isMd = useMediaQuery(BREAKPOINTS.md);
  const isLg = useMediaQuery(BREAKPOINTS.lg);
  const isXl = useMediaQuery(BREAKPOINTS.xl);
  const is2xl = useMediaQuery(BREAKPOINTS["2xl"]);

  // Derived convenience values
  const isMobile = !isMd; // < 768px
  const isTablet = isMd && !isLg; // 768px - 1023px
  const isDesktop = isLg; // >= 1024px

  return {
    // Raw breakpoints
    isSm,
    isMd,
    isLg,
    isXl,
    is2xl,

    // Convenience values
    isMobile,
    isTablet,
    isDesktop,

    // Screen size category
    screenSize: isMobile ? "mobile" : isTablet ? "tablet" : "desktop",
  } as const;
}

/**
 * Hook specifically for mobile detection.
 * Returns true if screen width is less than 768px.
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

/**
 * Hook for touch device detection.
 * Uses media query for hover capability.
 */
export function useIsTouchDevice(): boolean {
  return useMediaQuery("(hover: none) and (pointer: coarse)");
}
