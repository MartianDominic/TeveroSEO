/**
 * useConnectionWizard Hook
 * Phase 66-04: Connection Wizard UI
 *
 * State management for the multi-step connection wizard.
 * Handles URL submission, platform detection, path selection, and verification.
 */
"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  connectApi,
  type DetectionResult,
  type GuideResponse,
} from "@/lib/api/connect";

// ============================================================================
// Types
// ============================================================================

export type WizardStep =
  | "url"
  | "detecting"
  | "choice"
  | "diy"
  | "developer"
  | "oauth"
  | "verifying"
  | "success"
  | "error";

export type ConnectionPath = "diy" | "developer" | "oauth";

export interface WizardState {
  step: WizardStep;
  url: string;
  detection: DetectionResult | null;
  guide: GuideResponse | null;
  siteId: string | null;
  currentGuideStep: number;
  error: string | null;
}

export interface UseConnectionWizardOptions {
  workspaceId?: string;
  onSuccess?: (siteId: string) => void;
  onError?: (error: string) => void;
}

export interface UseConnectionWizardReturn {
  state: WizardState;
  submitUrl: (url: string) => void;
  selectPath: (path: ConnectionPath) => void;
  nextGuideStep: () => void;
  prevGuideStep: () => void;
  retry: () => void;
  startVerification: () => void;
  setState: (state: WizardState) => void;
  canProceed: boolean;
  progress: number;
}

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_STATE: WizardState = {
  step: "url",
  url: "",
  detection: null,
  guide: null,
  siteId: null,
  currentGuideStep: 0,
  error: null,
};

// ============================================================================
// Progress Mapping
// ============================================================================

const STEP_PROGRESS: Record<WizardStep, number> = {
  url: 0,
  detecting: 20,
  choice: 40,
  diy: 60,
  developer: 60,
  oauth: 60,
  verifying: 80,
  success: 100,
  error: 0,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useConnectionWizard(
  options: UseConnectionWizardOptions = {}
): UseConnectionWizardReturn {
  const { workspaceId, onSuccess, onError } = options;

  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const verificationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup verification polling on unmount
  useEffect(() => {
    return () => {
      if (verificationIntervalRef.current) {
        clearInterval(verificationIntervalRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // URL Submission
  // ---------------------------------------------------------------------------

  const submitUrl = useCallback(
    async (url: string) => {
      // Transition to detecting state
      setState((prev) => ({
        ...prev,
        step: "detecting",
        url,
        error: null,
      }));

      try {
        // Detect platform
        const detection = await connectApi.detect(url);

        // Create installation if workspace is provided
        let siteId: string | null = null;
        if (workspaceId) {
          const installation = await connectApi.createInstallation(workspaceId, url);
          siteId = installation.siteId;
        }

        // Transition to choice state
        setState((prev) => ({
          ...prev,
          step: "choice",
          detection,
          siteId,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          step: "error",
          error: message,
        }));
        onError?.(message);
      }
    },
    [workspaceId, onError]
  );

  // ---------------------------------------------------------------------------
  // Path Selection
  // ---------------------------------------------------------------------------

  const selectPath = useCallback(
    async (path: ConnectionPath) => {
      if (path === "diy") {
        // Fetch guide for DIY path
        const platform = state.detection?.platform;
        if (!platform) return;

        try {
          const guide = await connectApi.getGuide(platform, state.siteId ?? undefined);
          setState((prev) => ({
            ...prev,
            step: "diy",
            guide,
            currentGuideStep: 0,
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load guide";
          setState((prev) => ({
            ...prev,
            step: "error",
            error: message,
          }));
        }
      } else if (path === "developer") {
        setState((prev) => ({
          ...prev,
          step: "developer",
        }));
      } else if (path === "oauth") {
        setState((prev) => ({
          ...prev,
          step: "oauth",
        }));
      }
    },
    [state.detection?.platform, state.siteId]
  );

  // ---------------------------------------------------------------------------
  // Guide Navigation
  // ---------------------------------------------------------------------------

  const nextGuideStep = useCallback(() => {
    const totalSteps = state.guide?.guide.steps.length ?? 0;
    const isLastStep = state.currentGuideStep >= totalSteps - 1;

    if (isLastStep) {
      // Transition to verifying
      setState((prev) => ({
        ...prev,
        step: "verifying",
      }));
    } else {
      setState((prev) => ({
        ...prev,
        currentGuideStep: prev.currentGuideStep + 1,
      }));
    }
  }, [state.guide?.guide.steps.length, state.currentGuideStep]);

  const prevGuideStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentGuideStep: Math.max(0, prev.currentGuideStep - 1),
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Verification Polling
  // ---------------------------------------------------------------------------

  const startVerification = useCallback(() => {
    if (!state.siteId) return;

    // Clear any existing interval
    if (verificationIntervalRef.current) {
      clearInterval(verificationIntervalRef.current);
    }

    const pollVerification = async () => {
      try {
        const result = await connectApi.verify(state.siteId!);

        if (result.status === "detected" || result.status === "verified") {
          // Clear polling
          if (verificationIntervalRef.current) {
            clearInterval(verificationIntervalRef.current);
            verificationIntervalRef.current = null;
          }

          // Transition to success
          setState((prev) => ({
            ...prev,
            step: "success",
          }));
          onSuccess?.(state.siteId!);
        }
        // If still pending, continue polling
      } catch (error) {
        // Ignore errors during polling, keep trying
      }
    };

    // Start polling every 3 seconds
    verificationIntervalRef.current = setInterval(pollVerification, 3000);

    // Also poll immediately
    pollVerification();
  }, [state.siteId, onSuccess]);

  // ---------------------------------------------------------------------------
  // Retry
  // ---------------------------------------------------------------------------

  const retry = useCallback(() => {
    // Clear any polling
    if (verificationIntervalRef.current) {
      clearInterval(verificationIntervalRef.current);
      verificationIntervalRef.current = null;
    }

    setState(INITIAL_STATE);
  }, []);

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------

  const canProceed = useMemo(() => {
    if (state.step === "url") {
      // URL must be non-empty
      return state.url.trim().length > 0;
    }
    return true;
  }, [state.step, state.url]);

  const progress = useMemo(() => {
    return STEP_PROGRESS[state.step] ?? 0;
  }, [state.step]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    state,
    submitUrl,
    selectPath,
    nextGuideStep,
    prevGuideStep,
    retry,
    startVerification,
    setState,
    canProceed,
    progress,
  };
}
