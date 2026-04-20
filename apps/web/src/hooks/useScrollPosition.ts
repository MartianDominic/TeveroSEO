import { useEffect, useRef, useCallback } from "react";

/**
 * Hook to persist and restore scroll position across navigation.
 * Uses sessionStorage so position persists within the browser session
 * but is cleared when the tab/window is closed.
 *
 * @param key - Unique key for this scroll container (e.g., "dashboard-table")
 * @returns ref to attach to the scrollable container element
 *
 * @example
 * ```tsx
 * function MyTable() {
 *   const scrollRef = useScrollPosition("my-table");
 *   return (
 *     <div ref={scrollRef} className="overflow-auto h-96">
 *       {/* table content *\/}
 *     </div>
 *   );
 * }
 * ```
 */
export function useScrollPosition(key: string) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(false);

  // Restore scroll position on mount
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const savedPosition = sessionStorage.getItem(`scroll-${key}`);
    if (savedPosition) {
      isRestoringRef.current = true;
      element.scrollTop = parseInt(savedPosition, 10);
      // Reset flag after restore
      requestAnimationFrame(() => {
        isRestoringRef.current = false;
      });
    }
  }, [key]);

  // Save scroll position on scroll
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const handleScroll = () => {
      // Don't save while restoring
      if (isRestoringRef.current) return;
      sessionStorage.setItem(`scroll-${key}`, String(element.scrollTop));
    };

    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, [key]);

  return scrollRef;
}

/**
 * Hook to persist both scroll position and scroll direction.
 * Useful for infinite scroll or pagination that depends on scroll direction.
 *
 * @param key - Unique key for this scroll container
 * @returns { scrollRef, scrollDirection }
 */
export function useScrollPositionWithDirection(key: string) {
  const scrollRef = useScrollPosition(key);
  const lastScrollTop = useRef(0);
  const scrollDirection = useRef<"up" | "down" | "idle">("idle");

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const handleScroll = () => {
      const currentScrollTop = element.scrollTop;
      if (currentScrollTop > lastScrollTop.current) {
        scrollDirection.current = "down";
      } else if (currentScrollTop < lastScrollTop.current) {
        scrollDirection.current = "up";
      }
      lastScrollTop.current = currentScrollTop;
    };

    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, []);

  const getScrollDirection = useCallback(() => scrollDirection.current, []);

  return { scrollRef, getScrollDirection };
}

/**
 * Clear saved scroll position for a specific key.
 * Useful when navigating away or resetting state.
 */
export function clearScrollPosition(key: string) {
  sessionStorage.removeItem(`scroll-${key}`);
}
