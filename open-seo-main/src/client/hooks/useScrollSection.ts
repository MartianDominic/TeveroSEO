/**
 * useScrollSection hook
 * Phase 30: Interactive Proposal Page
 *
 * Manages scroll-triggered section animations using Intersection Observer.
 * Tracks active section and visibility state for scrollytelling experience.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export const DEFAULT_THRESHOLD = 0.5;

interface UseScrollSectionOptions {
  sectionIds: string[];
  threshold?: number;
  rootMargin?: string;
}

interface UseScrollSectionReturn<T extends string> {
  sectionRefs: React.MutableRefObject<Record<T, HTMLElement | null>>;
  activeSection: T;
  visibleSections: Record<T, boolean>;
  scrollToSection: (sectionId: T) => void;
  observeSection: (sectionId: T) => void;
}

export function useScrollSection<T extends string>({
  sectionIds,
  threshold = DEFAULT_THRESHOLD,
  rootMargin = "0px",
}: UseScrollSectionOptions): UseScrollSectionReturn<T> {
  // Initialize refs for all sections
  const sectionRefs = useRef<Record<T, HTMLElement | null>>(
    sectionIds.reduce(
      (acc, id) => ({ ...acc, [id]: null }),
      {} as Record<T, HTMLElement | null>,
    ),
  );

  // Track active section (most visible one)
  const [activeSection, setActiveSection] = useState<T>(sectionIds[0] as T);

  // Track visibility state for each section
  const [visibleSections, setVisibleSections] = useState<Record<T, boolean>>(
    sectionIds.reduce(
      (acc, id) => ({ ...acc, [id]: false }),
      {} as Record<T, boolean>,
    ),
  );

  // Store observer reference
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Create intersection observer callback
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        const sectionId = entry.target.getAttribute("data-section") as T;
        if (!sectionId) return;

        // Update visibility state
        setVisibleSections((prev) => ({
          ...prev,
          [sectionId]: entry.isIntersecting,
        }));

        // Update active section if this section is now most visible
        if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
          setActiveSection(sectionId);
        }
      });
    },
    [threshold],
  );

  // Initialize observer on mount
  useEffect(() => {
    observerRef.current = new IntersectionObserver(handleIntersection, {
      threshold: [0, 0.25, 0.5, 0.75, 1],
      rootMargin,
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [handleIntersection, rootMargin]);

  // Function to observe a specific section
  const observeSection = useCallback((sectionId: T) => {
    const element = sectionRefs.current[sectionId];
    if (element && observerRef.current) {
      observerRef.current.observe(element);
    }
  }, []);

  // Scroll to a specific section
  const scrollToSection = useCallback((sectionId: T) => {
    const element = sectionRefs.current[sectionId];
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, []);

  return {
    sectionRefs,
    activeSection,
    visibleSections,
    scrollToSection,
    observeSection,
  };
}
