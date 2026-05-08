/**
 * useIndexNowInstructions Hook
 *
 * Manages state and logic for the IndexNow manual instruction flow.
 * Handles platform detection, step navigation, and verification.
 */

import { useCallback, useMemo, useState } from "react";
import type {
  Platform,
  PlatformInstructions,
  InstructionVariables,
} from "@/lib/indexnow/instruction-templates";
import {
  generateInstructions,
  generateVerificationUrl,
  getSupportedPlatforms,
} from "@/lib/indexnow/instruction-templates";

// ============================================================================
// Types
// ============================================================================

export type InstructionState =
  | "idle"
  | "platform-select"
  | "instructions"
  | "verification"
  | "success"
  | "error";

export interface UseIndexNowInstructionsOptions {
  /** The IndexNow API key */
  apiKey: string;
  /** Client's domain */
  domain: string;
  /** Pre-selected platform (if detected) */
  initialPlatform?: Platform;
  /** Client name for personalization */
  clientName?: string;
  /** Callback when verification succeeds */
  onVerified?: () => void;
  /** Callback when user skips */
  onSkipped?: () => void;
}

export interface UseIndexNowInstructionsReturn {
  // State
  state: InstructionState;
  platform: Platform | null;
  currentStep: number;
  instructions: (PlatformInstructions & { interpolatedSteps: any[] }) | null;
  variables: InstructionVariables;
  verificationUrl: string;
  platforms: ReturnType<typeof getSupportedPlatforms>;

  // Verification state
  isVerifying: boolean;
  isVerified: boolean;
  verifyError: string | null;

  // Actions
  selectPlatform: (platform: Platform) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  startVerification: () => void;
  verify: () => Promise<boolean>;
  reset: () => void;
  skip: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useIndexNowInstructions({
  apiKey,
  domain,
  initialPlatform,
  clientName,
  onVerified,
  onSkipped,
}: UseIndexNowInstructionsOptions): UseIndexNowInstructionsReturn {
  // State
  const [state, setState] = useState<InstructionState>(
    initialPlatform ? "instructions" : "platform-select"
  );
  const [platform, setPlatform] = useState<Platform | null>(initialPlatform || null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Computed values
  const variables: InstructionVariables = useMemo(
    () => ({
      apiKey,
      domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      fullDomain: domain.startsWith("http") ? domain : `https://${domain}`,
      clientName,
    }),
    [apiKey, domain, clientName]
  );

  const instructions = useMemo(() => {
    if (!platform) return null;
    return generateInstructions(platform, variables);
  }, [platform, variables]);

  const verificationUrl = useMemo(
    () => generateVerificationUrl(variables.domain, apiKey),
    [variables.domain, apiKey]
  );

  const platforms = useMemo(() => getSupportedPlatforms(), []);

  // Actions
  const selectPlatform = useCallback((p: Platform) => {
    setPlatform(p);
    setCurrentStep(0);
    setState("instructions");
    setVerifyError(null);
  }, []);

  const nextStep = useCallback(() => {
    if (!instructions) return;

    if (currentStep < instructions.steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      setState("verification");
    }
  }, [currentStep, instructions]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    } else {
      setState("platform-select");
      setPlatform(null);
    }
  }, [currentStep]);

  const goToStep = useCallback(
    (step: number) => {
      if (!instructions) return;
      if (step >= 0 && step < instructions.steps.length) {
        setCurrentStep(step);
        setState("instructions");
      }
    },
    [instructions]
  );

  const startVerification = useCallback(() => {
    setState("verification");
    setVerifyError(null);
  }, []);

  const verify = useCallback(async (): Promise<boolean> => {
    setIsVerifying(true);
    setVerifyError(null);

    try {
      const response = await fetch(
        `/api/indexnow/verify?url=${encodeURIComponent(verificationUrl)}`
      );
      const data = await response.json();

      if (data.verified) {
        setIsVerified(true);
        setState("success");
        onVerified?.();
        return true;
      } else {
        setVerifyError(data.error || "Verification failed");
        setState("error");
        return false;
      }
    } catch (err) {
      const error = (err as Error).message;
      setVerifyError(error);
      setState("error");
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [verificationUrl, onVerified]);

  const reset = useCallback(() => {
    setState("platform-select");
    setPlatform(null);
    setCurrentStep(0);
    setIsVerified(false);
    setVerifyError(null);
  }, []);

  const skip = useCallback(() => {
    onSkipped?.();
  }, [onSkipped]);

  return {
    // State
    state,
    platform,
    currentStep,
    instructions,
    variables,
    verificationUrl,
    platforms,

    // Verification state
    isVerifying,
    isVerified,
    verifyError,

    // Actions
    selectPlatform,
    nextStep,
    prevStep,
    goToStep,
    startVerification,
    verify,
    reset,
    skip,
  };
}

export default useIndexNowInstructions;
