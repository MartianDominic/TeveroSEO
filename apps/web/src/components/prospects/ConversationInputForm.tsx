"use client";

import { Label, Textarea } from "@tevero/ui";
import { useTranslations } from "next-intl";
import { useProspectWizardStore } from "@/stores/prospect-wizard-store";

const MIN_CONVERSATION_LENGTH = 50;
const MAX_CONVERSATION_LENGTH = 50000;

export function ConversationInputForm() {
  const t = useTranslations("prospects.wizard");
  const { formData, setFormData, isSubmitting, error } = useProspectWizardStore();

  const charCount = formData.conversationText?.length || 0;
  const isValid = charCount >= MIN_CONVERSATION_LENGTH;

  // Check if error is conversation-related
  const hasConversationError = error && (
    error.includes("conversation") ||
    error.includes("Conversation") ||
    error.includes("short")
  );

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="space-y-[var(--space-2)]">
        <Label htmlFor="conversationText">
          {t("conversationText")} <span className="text-error">*</span>
        </Label>
        <Textarea
          id="conversationText"
          placeholder={t("conversationTextPlaceholder")}
          value={formData.conversationText || ""}
          onChange={(e) => setFormData({ conversationText: e.target.value })}
          disabled={isSubmitting}
          rows={10}
          maxLength={MAX_CONVERSATION_LENGTH}
          className="font-mono text-[length:var(--type-body)]"
          aria-invalid={hasConversationError || !isValid ? "true" : undefined}
          aria-describedby="conversation-hint conversation-count"
        />
        <div className="flex justify-between text-[length:var(--type-tiny)]">
          <p
            id="conversation-hint"
            className={isValid ? "text-text-3" : "text-error"}
            role={!isValid ? "alert" : undefined}
          >
            {t("minCharacters", { count: MIN_CONVERSATION_LENGTH })}
          </p>
          <p id="conversation-count" className="text-text-3">
            {charCount.toLocaleString()} /{" "}
            {MAX_CONVERSATION_LENGTH.toLocaleString()}
          </p>
        </div>
        {hasConversationError && (
          <p id="conversation-error" role="alert" className="text-[length:var(--type-tiny)] text-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
