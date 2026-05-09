"use client";

import { useTranslations } from "next-intl";

import { useProspectWizardStore } from "@/stores/prospect-wizard-store";

import { Input, Label } from "@tevero/ui";

export function WebsiteInputForm() {
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
        <Label htmlFor="domain">
          {t("domain")} <span className="text-error">*</span>
        </Label>
        <Input
          id="domain"
          placeholder="example.com"
          value={formData.domain || ""}
          onChange={(e) => setFormData({ domain: e.target.value })}
          disabled={isSubmitting}
          aria-invalid={hasDomainError ? "true" : undefined}
          aria-describedby={hasDomainError ? "domain-error" : "domain-hint"}
        />
        <p id="domain-hint" className="text-[length:var(--type-tiny)] text-text-3">
          {t("domainHint")}
        </p>
        {hasDomainError && (
          <p id="domain-error" role="alert" className="text-[length:var(--type-tiny)] text-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
