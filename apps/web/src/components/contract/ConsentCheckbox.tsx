"use client";

/**
 * Legal consent checkbox for contract signing.
 * Phase 59: Agreement & Signing Excellence
 *
 * Required before signing per D-20.
 * Uses next-intl for localized consent text.
 */
import { useTranslations } from "next-intl";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ConsentCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ConsentCheckbox({
  checked,
  onCheckedChange,
}: ConsentCheckboxProps) {
  const t = useTranslations("agreement.viewer");

  return (
    <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <Checkbox
        id="consent"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <Label
        htmlFor="consent"
        className="text-sm text-gray-700 leading-relaxed cursor-pointer"
      >
        {t("consent")}
      </Label>
    </div>
  );
}
