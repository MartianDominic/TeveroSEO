"use client";

import { create } from "zustand";

export type WizardStep = "input" | "progress" | "confirmation" | "complete";
export type InputMode = "website" | "website_with_context" | "conversation";

export interface WizardFormData {
  domain?: string;
  contextNotes?: string;
  conversationText?: string;
  companyName?: string;
  contactEmail?: string;
  contactName?: string;
  industry?: string;
  source?: string;
}

export interface ExtractionResult {
  businessName?: string;
  industry?: string;
  services?: string[];
  targetAudience?: string;
  keywords?: string[];
  location?: string;
  confidence: number;
}

export type ConfirmationMode = "confirm" | "autonomous";

interface ProspectWizardState {
  isOpen: boolean;
  step: WizardStep;
  mode: InputMode;
  formData: WizardFormData;
  extractedData: ExtractionResult | null;
  isSubmitting: boolean;
  error: string | null;
  confirmationMode: ConfirmationMode;

  // Actions
  open: () => void;
  close: () => void;
  setStep: (step: WizardStep) => void;
  setMode: (mode: InputMode) => void;
  setFormData: (data: Partial<WizardFormData>) => void;
  setExtractedData: (data: ExtractionResult) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setError: (error: string | null) => void;
  setConfirmationMode: (mode: ConfirmationMode) => void;
  reset: () => void;
}

const initialState = {
  isOpen: false,
  step: "input" as WizardStep,
  mode: "website" as InputMode,
  formData: {},
  extractedData: null,
  isSubmitting: false,
  error: null,
  confirmationMode: "confirm" as ConfirmationMode,
};

export const useProspectWizardStore = create<ProspectWizardState>((set) => ({
  ...initialState,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setStep: (step) => set({ step }),
  setMode: (mode) => set({ mode, formData: {} }), // Reset form when mode changes
  setFormData: (data) =>
    set((state) => ({ formData: { ...state.formData, ...data } })),
  setExtractedData: (data) => set({ extractedData: data }),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setError: (error) => set({ error }),
  setConfirmationMode: (confirmationMode) => set({ confirmationMode }),
  reset: () => set(initialState),
}));
