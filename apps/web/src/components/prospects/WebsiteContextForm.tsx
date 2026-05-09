"use client";

import { useTranslations } from "next-intl";

import { useProspectWizardStore } from "@/stores/prospect-wizard-store";

import { Input, Label, Textarea } from "@tevero/ui";

export function WebsiteContextForm() {
  const t = useTranslations("prospects.wizard");
  const { formData, setFormData, isSubmitting, error } = useProspectWizardStore();

  // Check if error is domain-related
  const hasDomainError = error && (
    error.includes("domain") ||
    error.includes("Domain") ||
    error.includes("required")
  );

  return (
    <div className="space-y-[var(--space-4)]">
      <div className="space-y-[var(--space-2)]">
        <Label htmlFor="domain-context">
          {t("domain")} <span className="text-error">*</span>
        </Label>
        <Input
          id="domain-context"
          placeholder="example.com"
          value={formData.domain || ""}
          onChange={(e) => setFormData({ domain: e.target.value })}
          disabled={isSubmitting}
          aria-invalid={hasDomainError ? "true" : undefined}
          aria-describedby={hasDomainError ? "domain-context-error" : undefined}
        />
        {hasDomainError && (
          <p id="domain-context-error" role="alert" className="text-[length:var(--type-tiny)] text-error">
            {error}
          </p>
        )}
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
          aria-describedby="context-notes-hint"
        />
        <p id="context-notes-hint" className="text-[length:var(--type-tiny)] text-text-3">
          {t("contextNotesHint")}
        </p>
      </div>
    </div>
  );
}
