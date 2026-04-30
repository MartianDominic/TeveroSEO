"use client";

import { Input, Label, Textarea } from "@tevero/ui";
import { useTranslations } from "next-intl";
import { useProspectWizardStore } from "@/stores/prospect-wizard-store";

export function WebsiteContextForm() {
  const t = useTranslations("prospects.wizard");
  const { formData, setFormData, isSubmitting } = useProspectWizardStore();

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="space-y-[var(--space-2)]">
        <Label htmlFor="domain">
          {t("domain")} <span className="text-error">*</span>
        </Label>
        <Input
          id="domain"
          placeholder="example.com"
          value={formData.domain || ""}
          onChange={(e) => setFormData({ domain: e.target.value })}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-[var(--space-2)]">
        <Label htmlFor="contextNotes">{t("contextNotes")}</Label>
        <Textarea
          id="contextNotes"
          placeholder={t("contextNotesPlaceholder")}
          value={formData.contextNotes || ""}
          onChange={(e) => setFormData({ contextNotes: e.target.value })}
          disabled={isSubmitting}
          rows={6}
          maxLength={50000}
        />
        <p className="text-[length:var(--type-tiny)] text-text-3">
          {t("contextNotesHint")}
        </p>
      </div>
    </div>
  );
}
