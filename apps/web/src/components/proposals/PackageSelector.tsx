"use client";

/**
 * PackageSelector Component - SEO package radio button selection.
 * Phase 58-03: Service Catalog - Proposal Integration
 *
 * Displays SEO packages as radio buttons (mutually exclusive selection).
 * Shows package name, price, setup fee, and inclusions preview.
 */

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import * as Icons from "lucide-react";
import { useTranslations } from "next-intl";

interface ServiceTemplate {
  id: string;
  name: string;
  nameEn?: string | null;
  nameLt?: string | null;
  basePriceCents: number | null;
  setupFeeCents?: number | null;
  inclusions?: string[] | null;
  icon?: string | null;
}

interface Props {
  packages: ServiceTemplate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  currency?: string;
  locale?: string;
}

/**
 * Renders SEO packages as radio buttons.
 * Only one package can be selected at a time (mutually exclusive).
 */
export function PackageSelector({
  packages,
  selectedId,
  onSelect,
  currency = "EUR",
  locale = "en",
}: Props) {
  const t = useTranslations("serviceCatalog");

  const formatPrice = (cents: number | null) => {
    if (cents === null) return "-";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(cents / 100);
  };

  const getName = (pkg: ServiceTemplate) => {
    if (locale === "lt" && pkg.nameLt) return pkg.nameLt;
    if (locale === "en" && pkg.nameEn) return pkg.nameEn;
    return pkg.name;
  };

  // Determine recommended package (middle tier or first if only one)
  const recommendedIdx = packages.length > 1 ? Math.floor(packages.length / 2) : 0;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        {t("selector.corePackage")}
      </h3>
      <RadioGroup
        value={selectedId || ""}
        onValueChange={onSelect}
        className="space-y-2"
      >
        {packages.map((pkg, idx) => {
          // Get icon component from Lucide
          const IconComponent =
            pkg.icon && Icons[pkg.icon as keyof typeof Icons]
              ? (Icons[pkg.icon as keyof typeof Icons] as React.ComponentType<{
                  className?: string;
                }>)
              : Icons.Package;

          const isSelected = selectedId === pkg.id;
          const isRecommended = idx === recommendedIdx;

          return (
            <label
              key={pkg.id}
              className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors
                ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value={pkg.id} id={pkg.id} />
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                  <IconComponent className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getName(pkg)}</span>
                    {isRecommended && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {t("selector.recommended")}
                      </Badge>
                    )}
                  </div>
                  {pkg.inclusions && pkg.inclusions.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {pkg.inclusions.slice(0, 3).join(" • ")}
                      {pkg.inclusions.length > 3 &&
                        ` +${pkg.inclusions.length - 3}`}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {formatPrice(pkg.basePriceCents)}
                  {t("perMonth")}
                </div>
                {pkg.setupFeeCents != null && pkg.setupFeeCents > 0 && (
                  <div className="text-xs text-muted-foreground">
                    + {formatPrice(pkg.setupFeeCents)} setup
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}

export default PackageSelector;
