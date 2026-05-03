"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@tevero/ui";
import { Globe, MessageSquare, FileText, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import {
  useProspectWizardStore,
  type ExtractionResult,
} from "@/stores/prospect-wizard-store";
import { WebsiteInputForm } from "./WebsiteInputForm";
import { WebsiteContextForm } from "./WebsiteContextForm";
import { ConversationInputForm } from "./ConversationInputForm";
import { ExtractionConfirmation } from "./ExtractionConfirmation";
import { AnalysisProgress } from "./AnalysisProgress";
import {
  extractFromConversationAction,
  confirmAndCreateProspectAction,
} from "@/app/(shell)/prospects/actions";

interface AddProspectModalProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function AddProspectModal({
  trigger,
  onSuccess,
}: AddProspectModalProps) {
  const t = useTranslations("prospects.wizard");
  const {
    isOpen,
    step,
    mode,
    formData,
    isSubmitting,
    error,
    extractedData,
    open,
    close,
    setStep,
    setMode,
    setError,
    setExtractedData,
    setSubmitting,
    reset,
  } = useProspectWizardStore();

  const [progressId, setProgressId] = useState<string | null>(null);

  // P56-H2 FIX: Track if form has unsaved changes for beforeunload warning
  const isDirty = Boolean(
    formData.domain?.trim() ||
    formData.conversationText?.trim() ||
    formData.contextNotes?.trim()
  );

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setProgressId(null);
      reset();
    }
  }, [isOpen, reset]);

  // P56-H2 FIX: Warn user when navigating away with unsaved changes
  useEffect(() => {
    if (!isDirty || !isOpen) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isOpen]);

  const handleAnalyze = async () => {
    // Validate required fields based on mode
    if (mode === "website" || mode === "website_with_context") {
      if (!formData.domain?.trim()) {
        setError(t("errors.domainRequired"));
        return;
      }
      // Basic domain format validation
      // P56-H1 FIX: Normalize domain to lowercase to prevent duplicates
      const domainRegex =
        /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
      const cleanDomain = formData.domain
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0]
        .toLowerCase();
      if (!domainRegex.test(cleanDomain)) {
        setError(t("errors.invalidDomain"));
        return;
      }
    }

    if (mode === "conversation") {
      if (
        !formData.conversationText ||
        formData.conversationText.length < 50
      ) {
        setError(t("errors.conversationTooShort"));
        return;
      }
    }

    setError(null);
    setSubmitting(true);

    // Generate a temporary ID for progress tracking
    const tempProgressId = nanoid();
    setProgressId(tempProgressId);
    setStep("progress");

    try {
      const content =
        mode === "conversation"
          ? formData.conversationText!
          : formData.contextNotes || "";

      const result = await extractFromConversationAction({
        content,
        inputMode: mode,
        domain: formData.domain,
        contextNotes:
          mode === "website_with_context" ? formData.contextNotes : undefined,
      });

      if (!result.success) {
        setError(result.error || t("errors.extractionFailed"));
        setStep("input");
        setProgressId(null);
        return;
      }

      setExtractedData(result.data);
      setStep("confirmation");
    } catch {
      setError(t("errors.extractionFailed"));
      setStep("input");
    } finally {
      setSubmitting(false);
      setProgressId(null);
    }
  };

  const handleConfirm = async (confirmedData: ExtractionResult) => {
    setSubmitting(true);
    try {
      const result = await confirmAndCreateProspectAction({
        domain: formData.domain,
        inputMode: mode,
        rawInput:
          mode === "conversation"
            ? formData.conversationText
            : formData.contextNotes,
        confirmedData,
      });

      if (!result.success) {
        setError(result.error || t("errors.createFailed"));
        return;
      }

      close();
      onSuccess?.();
    } catch {
      setError(t("errors.createFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReanalyze = (corrections: Partial<ExtractionResult>) => {
    // Prepend corrections as context and return to input step
    const correctionContext = `CORRECTIONS FROM USER:\n${JSON.stringify(corrections, null, 2)}\n\n`;
    useProspectWizardStore.getState().setFormData({
      contextNotes: correctionContext + (formData.contextNotes || ""),
    });
    setStep("input");
  };

  const isValid = (): boolean => {
    if (mode === "website" || mode === "website_with_context") {
      return Boolean(formData.domain?.trim());
    }
    if (mode === "conversation") {
      return Boolean(
        formData.conversationText && formData.conversationText.length >= 50
      );
    }
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(isDialogOpen) => (isDialogOpen ? open() : close())}>
      {trigger && (
        <div
          onClick={open}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && open()}
        >
          {trigger}
        </div>
      )}
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="py-[var(--space-4)]">
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as typeof mode)}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="website" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("modes.website")}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="website_with_context"
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {t("modes.websiteWithContext")}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="conversation"
                  className="flex items-center gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {t("modes.conversation")}
                  </span>
                </TabsTrigger>
              </TabsList>

              <div className="mt-[var(--space-4)]">
                <TabsContent value="website">
                  <WebsiteInputForm />
                </TabsContent>
                <TabsContent value="website_with_context">
                  <WebsiteContextForm />
                </TabsContent>
                <TabsContent value="conversation">
                  <ConversationInputForm />
                </TabsContent>
              </div>
            </Tabs>

            {error && (
              <div className="mt-[var(--space-4)] p-[var(--space-3)] rounded-[var(--radius-input)] bg-error/10 text-error text-[length:var(--type-body)]">
                {error}
              </div>
            )}
          </div>
        )}

        {step === "progress" && (
          <div className="py-[var(--space-6)]">
            <AnalysisProgress
              prospectId={progressId || undefined}
              onComplete={() => {
                // Progress display only - extraction handled by action
              }}
              onError={(errorMsg) => {
                setError(errorMsg);
                setStep("input");
                setProgressId(null);
                setSubmitting(false);
              }}
            />
          </div>
        )}

        {step === "confirmation" && extractedData && (
          <div className="py-[var(--space-4)]">
            <ExtractionConfirmation
              extraction={extractedData}
              onConfirm={handleConfirm}
              onReanalyze={handleReanalyze}
              isSubmitting={isSubmitting}
            />
            {error && (
              <div className="mt-[var(--space-4)] p-[var(--space-3)] rounded-[var(--radius-input)] bg-error/10 text-error text-[length:var(--type-body)]">
                {error}
              </div>
            )}
          </div>
        )}

        {step !== "confirmation" && step !== "progress" && (
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={isSubmitting}>
              {t("cancel")}
            </Button>
            <Button onClick={handleAnalyze} disabled={isSubmitting || !isValid()}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("analyze")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
