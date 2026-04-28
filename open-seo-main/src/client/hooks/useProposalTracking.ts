/**
 * useProposalTracking hook
 * Phase 30-04: Engagement Analytics
 *
 * Client-side hook for tracking proposal engagement:
 * - Page view on mount
 * - Duration heartbeat every 30s
 * - Section visibility tracking
 * - ROI calculator usage tracking
 */

"use client";

import { useEffect, useRef, useCallback } from "react";

// Heartbeat interval in milliseconds
const HEARTBEAT_INTERVAL_MS = 30000;

/**
 * Detect device type from window/navigator.
 */
function detectDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";

  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("ipad") || ua.includes("tablet")) {
    return "tablet";
  }
  if (
    ua.includes("mobile") ||
    ua.includes("iphone") ||
    ua.includes("android")
  ) {
    return "mobile";
  }
  return "desktop";
}

interface UseProposalTrackingReturn {
  trackSection: (sectionId: string) => void;
  trackRoiCalculator: () => void;
}

/**
 * Hook for tracking proposal engagement on the client side.
 *
 * @param proposalId - The proposal being viewed
 * @param token - The public access token for the proposal
 * @returns Object with tracking functions
 */
export function useProposalTracking(
  proposalId: string,
  token: string
): UseProposalTrackingReturn {
  // Internal state refs (don't cause re-renders)
  const viewIdRef = useRef<string | null>(null);
  const sectionsRef = useRef<Set<string>>(new Set());
  const startTimeRef = useRef<number>(Date.now());
  const roiTrackedRef = useRef<boolean>(false);
  const heartbeatRef = useRef<number | null>(null);

  // Track initial page view on mount
  useEffect(() => {
    const trackView = async () => {
      try {
        const response = await fetch("/api/proposals/track/view", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            proposalId,
            token,
            deviceType: detectDeviceType(),
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as { viewId: string };
          viewIdRef.current = data.viewId;
        }
      } catch (error) {
        // Silently fail - tracking should not break the page
        console.error("Failed to track proposal view:", error);
      }
    };

    trackView();

    // Set up heartbeat for duration tracking
    heartbeatRef.current = window.setInterval(async () => {
      if (!viewIdRef.current) return;

      const durationSeconds = Math.floor(
        (Date.now() - startTimeRef.current) / 1000
      );

      try {
        await fetch("/api/proposals/track/duration", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            viewId: viewIdRef.current,
            durationSeconds,
          }),
        });
      } catch (error) {
        // Silently fail - tracking should not break the page
        console.error("Failed to update duration:", error);
      }
    }, HEARTBEAT_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [proposalId, token]);

  // Track section visibility
  const trackSection = useCallback((sectionId: string) => {
    // Add to accumulated sections
    sectionsRef.current.add(sectionId);

    // Send update to server
    if (viewIdRef.current) {
      const sections = Array.from(sectionsRef.current);

      fetch("/api/proposals/track/sections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          viewId: viewIdRef.current,
          sections,
        }),
      }).catch((error) => {
        console.error("Failed to track section:", error);
      });
    }
  }, []);

  // Track ROI calculator usage (only once per session)
  const trackRoiCalculator = useCallback(() => {
    // Only track once per session
    if (roiTrackedRef.current) return;

    if (viewIdRef.current) {
      roiTrackedRef.current = true;

      fetch("/api/proposals/track/roi-calculator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          viewId: viewIdRef.current,
        }),
      }).catch((error) => {
        console.error("Failed to track ROI calculator:", error);
        // Reset flag on error so it can be retried
        roiTrackedRef.current = false;
      });
    }
  }, []);

  return {
    trackSection,
    trackRoiCalculator,
  };
}
