/**
 * Signing modal component for e-signature via Smart-ID/Mobile-ID.
 * Phase 30-05: E-Signature (Dokobit)
 *
 * Multi-step modal for proposal signing:
 * 1. Method selection (Smart-ID or Mobile-ID)
 * 2. Personal code input
 * 3. Verification code display with polling
 * 4. Success or error state
 *
 * All UI text is in Lithuanian for Lithuanian market.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  initiateProposalSigning,
  checkProposalSigningStatus,
} from "@/serverFunctions/proposals";

/**
 * Signing workflow steps.
 */
export const SIGNING_STEPS = [
  "method",
  "input",
  "verification",
  "success",
  "error",
] as const;

export type SigningStep = (typeof SIGNING_STEPS)[number];

/**
 * Lithuanian UI text strings.
 */
export const SIGNING_TEXT = {
  // Method selection
  methodTitle: "Pasirinkite pasirasymo buda",
  smartId: "Smart-ID",
  mobileId: "Mobile-ID",

  // Input step
  personalCodeLabel: "Asmens kodas",
  personalCodePlaceholder: "38501010001",
  phoneLabel: "Telefono numeris",
  phonePlaceholder: "+37060012345",
  nameLabel: "Vardas Pavarde",
  namePlaceholder: "Jonas Jonaitis",
  continueButton: "Testi",

  // Verification step
  verificationTitle: "Patvirtinimo kodas",
  verificationInstructions: "Patvirtinkite savo programeleje",
  smartIdInstructions: "Patvirtinkite Smart-ID programeleje",
  mobileIdInstructions: "Patvirtinkite Mobile-ID zinute",
  waiting: "Laukiama patvirtinimo...",

  // Success
  successTitle: "Pasirasytas!",
  successMessage: "Sutartis sekmingai pasirasytas",
  downloadButton: "Atsisiusti sutarti",
  closeButton: "Uzdaryti",

  // Error
  errorTitle: "Klaida",
  tryAgainButton: "Bandyti dar karta",
};

/**
 * Lithuanian error messages.
 */
export const SIGNING_ERRORS = {
  initFailed: "Nepavyko inicijuoti pasirasymo",
  cancelled: "Pasirasymas atsisakytas",
  expired: "Pasirasymo laikas baigesi",
  failed: "Pasirasymas nepavyko",
  invalidPersonalCode: "Neteisingas asmens kodas",
  invalidPhone: "Neteisingas telefono numeris",
  nameRequired: "Iveskite varda ir pavarde",
};

/**
 * Validates Lithuanian personal code format.
 * Must be exactly 11 digits.
 */
export function validatePersonalCodeFormat(code: string): boolean {
  return /^\d{11}$/.test(code);
}

/**
 * Validates phone number format.
 * Must start with +370 and have correct length.
 */
export function validatePhoneFormat(phone: string): boolean {
  return /^\+370\d{8}$/.test(phone);
}

export interface SigningModalProps {
  /** Public access token for the proposal */
  proposalToken: string;
  /** Callback when signing completes successfully */
  onSuccess: () => void;
  /** Callback to close the modal */
  onClose: () => void;
  /** Whether modal is open */
  open?: boolean;
}

/**
 * E-signature modal component.
 *
 * @example
 * <SigningModal
 *   proposalToken="abc123"
 *   onSuccess={() => refetch()}
 *   onClose={() => setShowModal(false)}
 *   open={showModal}
 * />
 */
export function SigningModal({
  proposalToken,
  onSuccess,
  onClose,
  open = true,
}: SigningModalProps) {
  const [step, setStep] = useState<SigningStep>("method");
  const [method, setMethod] = useState<"smart_id" | "mobile_id">();
  const [personalCode, setPersonalCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [signerName, setSignerName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Input validation
  const isPersonalCodeValid = validatePersonalCodeFormat(personalCode);
  const isPhoneValid = method === "mobile_id" ? validatePhoneFormat(phoneNumber) : true;
  const isNameValid = signerName.trim().length >= 3;
  const canContinue = isPersonalCodeValid && isPhoneValid && isNameValid;

  /**
   * Initiate signing session.
   */
  const handleInitiateSigning = useCallback(async () => {
    if (!method || !canContinue) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await initiateProposalSigning({
        data: {
          token: proposalToken,
          method,
          personalCode,
          phoneNumber: method === "mobile_id" ? phoneNumber : undefined,
          signerName,
        },
      });

      setSessionId(result.sessionId);
      setVerificationCode(result.verificationCode);
      setStep("verification");
    } catch (err) {
      setError(SIGNING_ERRORS.initFailed);
      setStep("error");
    } finally {
      setIsLoading(false);
    }
  }, [method, canContinue, proposalToken, personalCode, phoneNumber, signerName]);

  /**
   * Poll signing status.
   */
  useEffect(() => {
    if (step !== "verification" || !sessionId) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await checkProposalSigningStatus({
          data: {
            token: proposalToken,
            sessionId,
          },
        });

        if (status.status === "completed") {
          clearInterval(pollInterval);
          setStep("success");
          onSuccess();
        } else if (status.status === "failed") {
          clearInterval(pollInterval);
          setError(status.error ?? SIGNING_ERRORS.failed);
          setStep("error");
        } else if (status.status === "expired") {
          clearInterval(pollInterval);
          setError(SIGNING_ERRORS.expired);
          setStep("error");
        }
        // Keep polling if "pending"
      } catch (err) {
        clearInterval(pollInterval);
        setError(SIGNING_ERRORS.failed);
        setStep("error");
      }
    }, 2000);

    // Timeout after 3 minutes
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      setError(SIGNING_ERRORS.expired);
      setStep("error");
    }, 180000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [step, sessionId, proposalToken, onSuccess]);

  /**
   * Reset to try again.
   */
  const handleTryAgain = () => {
    setStep("method");
    setMethod(undefined);
    setPersonalCode("");
    setPhoneNumber("");
    setVerificationCode("");
    setSessionId("");
    setError("");
  };

  /**
   * Select signing method.
   */
  const handleSelectMethod = (selectedMethod: "smart_id" | "mobile_id") => {
    setMethod(selectedMethod);
    setStep("input");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md bg-white dark:bg-gray-900 rounded-xl p-6">
        {/* Method Selection Step */}
        {step === "method" && (
          <div className="space-y-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-center">
                {SIGNING_TEXT.methodTitle}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleSelectMethod("smart_id")}
                className="flex flex-col items-center p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="w-16 h-16 mb-3 flex items-center justify-center bg-green-100 dark:bg-green-900 rounded-full">
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    S
                  </span>
                </div>
                <span className="font-medium">{SIGNING_TEXT.smartId}</span>
              </button>

              <button
                onClick={() => handleSelectMethod("mobile_id")}
                className="flex flex-col items-center p-6 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="w-16 h-16 mb-3 flex items-center justify-center bg-blue-100 dark:bg-blue-900 rounded-full">
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    M
                  </span>
                </div>
                <span className="font-medium">{SIGNING_TEXT.mobileId}</span>
              </button>
            </div>
          </div>
        )}

        {/* Input Step */}
        {step === "input" && (
          <div className="space-y-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {method === "smart_id" ? SIGNING_TEXT.smartId : SIGNING_TEXT.mobileId}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signerName">{SIGNING_TEXT.nameLabel}</Label>
                <Input
                  id="signerName"
                  type="text"
                  placeholder={SIGNING_TEXT.namePlaceholder}
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className={!isNameValid && signerName ? "border-red-500" : ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="personalCode">{SIGNING_TEXT.personalCodeLabel}</Label>
                <Input
                  id="personalCode"
                  type="text"
                  placeholder={SIGNING_TEXT.personalCodePlaceholder}
                  value={personalCode}
                  onChange={(e) => setPersonalCode(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  maxLength={11}
                  className={!isPersonalCodeValid && personalCode ? "border-red-500" : ""}
                />
              </div>

              {method === "mobile_id" && (
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">{SIGNING_TEXT.phoneLabel}</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder={SIGNING_TEXT.phonePlaceholder}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className={!isPhoneValid && phoneNumber ? "border-red-500" : ""}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("method")} className="flex-1">
                Atgal
              </Button>
              <Button
                onClick={handleInitiateSigning}
                disabled={!canContinue || isLoading}
                className="flex-1"
              >
                {isLoading ? "..." : SIGNING_TEXT.continueButton}
              </Button>
            </div>
          </div>
        )}

        {/* Verification Step */}
        {step === "verification" && (
          <div className="space-y-6 text-center">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {SIGNING_TEXT.verificationTitle}
              </DialogTitle>
            </DialogHeader>

            <div className="py-8">
              <div className="text-6xl font-mono tracking-[0.5em] font-bold text-primary">
                {verificationCode}
              </div>
            </div>

            <p className="text-muted-foreground">
              {method === "smart_id"
                ? SIGNING_TEXT.smartIdInstructions
                : SIGNING_TEXT.mobileIdInstructions}
            </p>

            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>{SIGNING_TEXT.waiting}</span>
            </div>
          </div>
        )}

        {/* Success Step */}
        {step === "success" && (
          <div className="space-y-6 text-center py-6">
            <div className="w-20 h-20 mx-auto flex items-center justify-center bg-green-100 dark:bg-green-900 rounded-full">
              <svg
                className="w-10 h-10 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-green-600 dark:text-green-400">
                {SIGNING_TEXT.successTitle}
              </h3>
              <p className="text-muted-foreground mt-2">{SIGNING_TEXT.successMessage}</p>
            </div>

            <Button onClick={onClose} className="w-full">
              {SIGNING_TEXT.closeButton}
            </Button>
          </div>
        )}

        {/* Error Step */}
        {step === "error" && (
          <div className="space-y-6 text-center py-6">
            <div className="w-20 h-20 mx-auto flex items-center justify-center bg-red-100 dark:bg-red-900 rounded-full">
              <svg
                className="w-10 h-10 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-red-600 dark:text-red-400">
                {SIGNING_TEXT.errorTitle}
              </h3>
              <p className="text-muted-foreground mt-2">{error}</p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                {SIGNING_TEXT.closeButton}
              </Button>
              <Button onClick={handleTryAgain} className="flex-1">
                {SIGNING_TEXT.tryAgainButton}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
