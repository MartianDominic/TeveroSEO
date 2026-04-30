"use client";

import { Label, Textarea } from "@tevero/ui";
import { useTranslations } from "next-intl";
import { useProspectWizardStore } from "@/stores/prospect-wizard-store";

const MIN_CONVERSATION_LENGTH = 50;
const MAX_CONVERSATION_LENGTH = 50000;

export function ConversationInputForm() {
  const t = useTranslations("prospects.wizard");
  const { formData, setFormData, isSubmitting } = useProspectWizardStore();

  const charCount = formData.conversationText?.length || 0;
  const isValid = charCount >= MIN_CONVERSATION_LENGTH;

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
        />
        <div className="flex justify-between text-[length:var(--type-tiny)]">
          <p className={isValid ? "text-text-3" : "text-error"}>
            {t("minCharacters", { count: MIN_CONVERSATION_LENGTH })}
          </p>
          <p className="text-text-3">
            {charCount.toLocaleString()} /{" "}
            {MAX_CONVERSATION_LENGTH.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
