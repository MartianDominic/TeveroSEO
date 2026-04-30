"use client";

import { Input, Label } from "@tevero/ui";
import { useTranslations } from "next-intl";
import { useProspectWizardStore } from "@/stores/prospect-wizard-store";

export function WebsiteInputForm() {
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
        <p className="text-[length:var(--type-tiny)] text-text-3">
          {t("domainHint")}
        </p>
      </div>
    </div>
  );
}
